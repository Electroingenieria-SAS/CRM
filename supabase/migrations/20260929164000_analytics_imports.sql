begin;

create table erp_supply.analytics_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  import_type text not null check (import_type in ('ORDER_STAGE_HISTORY_V1')),
  file_name text not null check (btrim(file_name)<>''),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  source text not null check (btrim(source)<>''),
  status text not null default 'PREVIEWED'
    check (status in ('PREVIEWED','APPLYING','APPLIED','PARTIAL','FAILED')),
  total_rows integer not null default 0 check (total_rows>=0),
  valid_rows integer not null default 0 check (valid_rows>=0),
  rejected_rows integer not null default 0 check (rejected_rows>=0),
  applied_rows integer not null default 0 check (applied_rows>=0),
  created_by uuid not null references erp_supply.profiles(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  unique (organization_id,import_type,checksum_sha256)
);

create table erp_supply.analytics_import_rows (
  id bigint generated always as identity primary key,
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  batch_id uuid not null references erp_supply.analytics_import_batches(id) on delete cascade,
  row_number integer not null check (row_number>0),
  external_key text,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  status text not null check (status in ('VALID','INVALID','APPLIED','REJECTED')),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (batch_id,row_number)
);

alter table erp_supply.analytics_historical_stage_events
  add column import_batch_id uuid references erp_supply.analytics_import_batches(id);

create index idx_analytics_import_batches_time
on erp_supply.analytics_import_batches(organization_id,created_at desc);

create index idx_analytics_import_rows_batch_status
on erp_supply.analytics_import_rows(batch_id,status,row_number);

alter table erp_supply.analytics_import_batches enable row level security;
alter table erp_supply.analytics_import_rows enable row level security;

create policy analytics_import_batches_read
on erp_supply.analytics_import_batches
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('imports','read')
);

create policy analytics_import_rows_read
on erp_supply.analytics_import_rows
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('imports','read')
);

grant select on erp_supply.analytics_import_batches to authenticated;
grant select on erp_supply.analytics_import_rows to authenticated;
grant usage,select on sequence erp_supply.analytics_import_rows_id_seq to authenticated;

revoke insert,update,delete on erp_supply.analytics_import_batches from authenticated;
revoke insert,update,delete on erp_supply.analytics_import_rows from authenticated;

create or replace function public.erp_x_analytics_import_preview(
  p_import_type text,
  p_file_name text,
  p_checksum_sha256 text,
  p_file_size_bytes bigint,
  p_source text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_type text:=upper(btrim(coalesce(p_import_type,'')));
  v_checksum text:=lower(btrim(coalesce(p_checksum_sha256,'')));
  v_source text:=btrim(coalesce(p_source,''));
  v_batch erp_supply.analytics_import_batches%rowtype;
  v_row jsonb;
  v_number integer:=0;
  v_errors jsonb;
  v_normalized jsonb;
  v_external_key text;
  v_external_order_key text;
  v_order_number text;
  v_step text;
  v_task_created timestamptz;
  v_started timestamptz;
  v_completed timestamptz;
  v_waiting bigint;
  v_processing bigint;
  v_blocked bigint;
  v_transit bigint;
  v_valid integer:=0;
  v_invalid integer:=0;
begin
  if v_org is null or v_actor is null
     or not erp_private.can_access_module('imports','create') then
    raise exception 'No autorizado para preparar importaciones' using errcode='42501';
  end if;

  if v_type<>'ORDER_STAGE_HISTORY_V1' then
    raise exception 'Tipo de importación no soportado' using errcode='22023';
  end if;
  if btrim(coalesce(p_file_name,''))='' then
    raise exception 'Nombre de archivo requerido' using errcode='22023';
  end if;
  if v_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'Checksum SHA-256 inválido' using errcode='22023';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes<1 or p_file_size_bytes>10485760 then
    raise exception 'El archivo debe pesar entre 1 byte y 10 MB' using errcode='22023';
  end if;
  if v_source='' or length(v_source)>120 then
    raise exception 'Fuente de importación inválida' using errcode='22023';
  end if;
  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Las filas deben enviarse como arreglo' using errcode='22023';
  end if;
  if jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>2000 then
    raise exception 'La importación admite entre 1 y 2000 filas por archivo'
      using errcode='22023';
  end if;

  select * into v_batch
  from erp_supply.analytics_import_batches
  where organization_id=v_org
    and import_type=v_type
    and checksum_sha256=v_checksum
  for update;

  if found then
    return jsonb_build_object(
      'batchId',v_batch.id,
      'idempotent',true,
      'status',v_batch.status,
      'totalRows',v_batch.total_rows,
      'validRows',v_batch.valid_rows,
      'rejectedRows',v_batch.rejected_rows,
      'appliedRows',v_batch.applied_rows,
      'errors',coalesce((
        select jsonb_agg(jsonb_build_object(
          'rowNumber',r.row_number,'errors',r.errors
        ) order by r.row_number)
        from (
          select row_number,errors
          from erp_supply.analytics_import_rows
          where batch_id=v_batch.id and status in('INVALID','REJECTED')
          order by row_number
          limit 100
        ) r
      ),'[]'::jsonb),
      'contractVersion','1.0.0'
    );
  end if;

  insert into erp_supply.analytics_import_batches(
    organization_id,import_type,file_name,checksum_sha256,file_size_bytes,
    source,status,total_rows,created_by
  )
  values(
    v_org,v_type,btrim(p_file_name),v_checksum,p_file_size_bytes,
    v_source,'PREVIEWED',jsonb_array_length(p_rows),v_actor
  )
  returning * into v_batch;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_number:=v_number+1;
    v_errors:='[]'::jsonb;
    v_normalized:=null;
    v_external_key:=nullif(btrim(coalesce(v_row->>'externalKey','')),'');
    v_external_order_key:=nullif(btrim(coalesce(v_row->>'externalOrderKey','')),'');
    v_order_number:=nullif(btrim(coalesce(v_row->>'orderNumber','')),'');
    v_step:=upper(nullif(btrim(coalesce(v_row->>'stepCode','')),''));
    v_task_created:=null;
    v_started:=null;
    v_completed:=null;
    v_waiting:=null;
    v_processing:=null;
    v_blocked:=null;
    v_transit:=null;

    if v_external_key is null then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','externalKey','code','REQUIRED','message','externalKey es obligatorio')
      );
    end if;
    if v_external_order_key is null then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','externalOrderKey','code','REQUIRED','message','externalOrderKey es obligatorio')
      );
    end if;
    if v_order_number is null then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','orderNumber','code','REQUIRED','message','orderNumber es obligatorio')
      );
    end if;
    if v_step is null or not exists(
      select 1 from erp_supply.workflow_steps where code=v_step and active
    ) then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','stepCode','code','INVALID','message','Etapa no reconocida')
      );
    end if;

    begin
      v_task_created:=(v_row->>'taskCreatedAt')::timestamptz;
    exception when others then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','taskCreatedAt','code','INVALID','message','Fecha de creación inválida')
      );
    end;

    if nullif(v_row->>'startedAt','') is not null then
      begin v_started:=(v_row->>'startedAt')::timestamptz;
      exception when others then
        v_errors:=v_errors||jsonb_build_array(
          jsonb_build_object('field','startedAt','code','INVALID','message','Fecha de inicio inválida')
        );
      end;
    end if;

    if nullif(v_row->>'completedAt','') is not null then
      begin v_completed:=(v_row->>'completedAt')::timestamptz;
      exception when others then
        v_errors:=v_errors||jsonb_build_array(
          jsonb_build_object('field','completedAt','code','INVALID','message','Fecha de cierre inválida')
        );
      end;
    end if;

    begin v_waiting:=coalesce(nullif(v_row->>'waitingSeconds','')::bigint,0);
    exception when others then v_waiting:=-1; end;
    begin v_processing:=coalesce(nullif(v_row->>'processingSeconds','')::bigint,0);
    exception when others then v_processing:=-1; end;
    begin v_blocked:=coalesce(nullif(v_row->>'blockedSeconds','')::bigint,0);
    exception when others then v_blocked:=-1; end;
    begin
      if nullif(v_row->>'transitSeconds','') is not null then
        v_transit:=(v_row->>'transitSeconds')::bigint;
      end if;
    exception when others then v_transit:=-1; end;

    if coalesce(v_waiting,-1)<0 then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','waitingSeconds','code','INVALID','message','waitingSeconds debe ser >= 0')
      );
    end if;
    if coalesce(v_processing,-1)<0 then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','processingSeconds','code','INVALID','message','processingSeconds debe ser >= 0')
      );
    end if;
    if coalesce(v_blocked,-1)<0 then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','blockedSeconds','code','INVALID','message','blockedSeconds debe ser >= 0')
      );
    end if;
    if v_transit is not null and v_transit<0 then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','transitSeconds','code','INVALID','message','transitSeconds debe ser >= 0')
      );
    end if;
    if v_started is not null and v_task_created is not null and v_started<v_task_created then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','startedAt','code','ORDER','message','startedAt no puede preceder taskCreatedAt')
      );
    end if;
    if v_completed is not null and v_started is not null and v_completed<v_started then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','completedAt','code','ORDER','message','completedAt no puede preceder startedAt')
      );
    end if;
    if v_external_key is not null and exists(
      select 1
      from erp_supply.analytics_import_rows r
      where r.batch_id=v_batch.id and r.external_key=v_external_key
    ) then
      v_errors:=v_errors||jsonb_build_array(
        jsonb_build_object('field','externalKey','code','DUPLICATE','message','externalKey repetido dentro del archivo')
      );
    end if;

    if jsonb_array_length(v_errors)=0 then
      v_normalized:=jsonb_build_object(
        'externalKey',v_external_key,
        'externalOrderKey',v_external_order_key,
        'orderNumber',v_order_number,
        'clientName',nullif(btrim(coalesce(v_row->>'clientName','')),''),
        'sellerReference',nullif(btrim(coalesce(v_row->>'sellerReference','')),''),
        'routeCode',upper(nullif(btrim(coalesce(v_row->>'routeCode','')),'')),
        'stepCode',v_step,
        'taskCreatedAt',v_task_created,
        'startedAt',v_started,
        'completedAt',v_completed,
        'waitingSeconds',v_waiting,
        'processingSeconds',v_processing,
        'blockedSeconds',v_blocked,
        'transitSeconds',v_transit
      );
      v_valid:=v_valid+1;
    else
      v_invalid:=v_invalid+1;
    end if;

    insert into erp_supply.analytics_import_rows(
      organization_id,batch_id,row_number,external_key,raw_payload,
      normalized_payload,status,errors
    )
    values(
      v_org,v_batch.id,v_number,v_external_key,v_row,v_normalized,
      case when jsonb_array_length(v_errors)=0 then 'VALID' else 'INVALID' end,
      v_errors
    );
  end loop;

  update erp_supply.analytics_import_batches
  set valid_rows=v_valid,
      rejected_rows=v_invalid,
      result=jsonb_build_object(
        'policy','VALID_ROWS_PLUS_REJECTED_REPORT',
        'previewedAt',now()
      )
  where id=v_batch.id
  returning * into v_batch;

  return jsonb_build_object(
    'batchId',v_batch.id,
    'idempotent',false,
    'status',v_batch.status,
    'policy','VALID_ROWS_PLUS_REJECTED_REPORT',
    'totalRows',v_batch.total_rows,
    'validRows',v_batch.valid_rows,
    'rejectedRows',v_batch.rejected_rows,
    'preview',coalesce((
      select jsonb_agg(jsonb_build_object(
        'rowNumber',r.row_number,
        'status',r.status,
        'row',coalesce(r.normalized_payload,r.raw_payload),
        'errors',r.errors
      ) order by r.row_number)
      from (
        select *
        from erp_supply.analytics_import_rows
        where batch_id=v_batch.id
        order by row_number
        limit 20
      ) r
    ),'[]'::jsonb),
    'errors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'rowNumber',r.row_number,'errors',r.errors
      ) order by r.row_number)
      from (
        select row_number,errors
        from erp_supply.analytics_import_rows
        where batch_id=v_batch.id and status='INVALID'
        order by row_number
        limit 100
      ) r
    ),'[]'::jsonb),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_analytics_import_apply(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_batch erp_supply.analytics_import_batches%rowtype;
  v_applied integer:=0;
  v_rejected integer:=0;
  v_invalid integer:=0;
begin
  if v_org is null or v_actor is null
     or not erp_private.can_access_module('imports','create') then
    raise exception 'No autorizado para aplicar importaciones' using errcode='42501';
  end if;

  select * into v_batch
  from erp_supply.analytics_import_batches
  where id=p_batch_id and organization_id=v_org
  for update;

  if not found then
    raise exception 'Lote de importación no disponible' using errcode='P0002';
  end if;

  if v_batch.status in('APPLIED','PARTIAL') then
    return jsonb_build_object(
      'batchId',v_batch.id,
      'idempotent',true,
      'status',v_batch.status,
      'appliedRows',v_batch.applied_rows,
      'rejectedRows',v_batch.rejected_rows,
      'contractVersion','1.0.0'
    );
  end if;

  update erp_supply.analytics_import_batches
  set status='APPLYING'
  where id=v_batch.id;

  insert into erp_supply.analytics_historical_stage_events(
    organization_id,external_order_key,order_number,client_name,seller_reference,
    route_code,step_code,task_created_at,started_at,completed_at,
    waiting_seconds,processing_seconds,blocked_seconds,transit_seconds,
    source,external_key,created_by,import_batch_id,metadata
  )
  select
    v_org,
    r.normalized_payload->>'externalOrderKey',
    r.normalized_payload->>'orderNumber',
    nullif(r.normalized_payload->>'clientName',''),
    nullif(r.normalized_payload->>'sellerReference',''),
    nullif(r.normalized_payload->>'routeCode',''),
    r.normalized_payload->>'stepCode',
    (r.normalized_payload->>'taskCreatedAt')::timestamptz,
    nullif(r.normalized_payload->>'startedAt','')::timestamptz,
    nullif(r.normalized_payload->>'completedAt','')::timestamptz,
    (r.normalized_payload->>'waitingSeconds')::bigint,
    (r.normalized_payload->>'processingSeconds')::bigint,
    (r.normalized_payload->>'blockedSeconds')::bigint,
    nullif(r.normalized_payload->>'transitSeconds','')::bigint,
    v_batch.source,
    r.normalized_payload->>'externalKey',
    v_actor,
    v_batch.id,
    jsonb_build_object('importRowNumber',r.row_number)
  from erp_supply.analytics_import_rows r
  where r.batch_id=v_batch.id and r.status='VALID'
  on conflict (organization_id,source,external_key) do nothing;

  update erp_supply.analytics_import_rows r
  set status='APPLIED'
  where r.batch_id=v_batch.id
    and r.status='VALID'
    and exists(
      select 1
      from erp_supply.analytics_historical_stage_events h
      where h.organization_id=v_org
        and h.source=v_batch.source
        and h.external_key=r.normalized_payload->>'externalKey'
        and h.import_batch_id=v_batch.id
    );

  update erp_supply.analytics_import_rows r
  set status='REJECTED',
      errors=r.errors||jsonb_build_array(
        jsonb_build_object(
          'field','externalKey',
          'code','ALREADY_IMPORTED',
          'message','La fila ya existe en el histórico de esta fuente'
        )
      )
  where r.batch_id=v_batch.id and r.status='VALID';

  select count(*)::integer into v_applied
  from erp_supply.analytics_import_rows
  where batch_id=v_batch.id and status='APPLIED';

  select count(*)::integer into v_rejected
  from erp_supply.analytics_import_rows
  where batch_id=v_batch.id and status='REJECTED';

  select count(*)::integer into v_invalid
  from erp_supply.analytics_import_rows
  where batch_id=v_batch.id and status='INVALID';

  update erp_supply.analytics_import_batches
  set status=case when v_rejected+v_invalid=0 then 'APPLIED' else 'PARTIAL' end,
      applied_rows=v_applied,
      rejected_rows=v_rejected+v_invalid,
      applied_at=now(),
      result=jsonb_build_object(
        'policy','VALID_ROWS_PLUS_REJECTED_REPORT',
        'appliedRows',v_applied,
        'invalidRows',v_invalid,
        'duplicateRows',v_rejected,
        'appliedAt',now()
      )
  where id=v_batch.id
  returning * into v_batch;

  return jsonb_build_object(
    'batchId',v_batch.id,
    'idempotent',false,
    'status',v_batch.status,
    'totalRows',v_batch.total_rows,
    'appliedRows',v_batch.applied_rows,
    'rejectedRows',v_batch.rejected_rows,
    'errors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'rowNumber',r.row_number,
        'status',r.status,
        'errors',r.errors
      ) order by r.row_number)
      from (
        select row_number,status,errors
        from erp_supply.analytics_import_rows
        where batch_id=v_batch.id and status in('INVALID','REJECTED')
        order by row_number
        limit 100
      ) r
    ),'[]'::jsonb),
    'contractVersion','1.0.0'
  );
exception when others then
  if v_batch.id is not null then
    update erp_supply.analytics_import_batches
    set status='FAILED',
        result=jsonb_build_object('error',sqlerrm,'failedAt',now())
    where id=v_batch.id;
  end if;
  raise;
end;
$$;

create or replace function public.erp_x_analytics_imports(
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total integer;
  v_items jsonb;
begin
  if not erp_private.can_access_module('imports','read') then
    raise exception 'No autorizado para consultar importaciones' using errcode='42501';
  end if;

  select count(*)::integer into v_total
  from erp_supply.analytics_import_batches
  where organization_id=v_org;

  select coalesce(jsonb_agg(to_jsonb(x) order by x."createdAt" desc),'[]'::jsonb)
  into v_items
  from (
    select
      b.id "batchId",
      b.import_type "importType",
      b.file_name "fileName",
      b.checksum_sha256 checksum,
      b.source,
      b.status,
      b.total_rows "totalRows",
      b.valid_rows "validRows",
      b.applied_rows "appliedRows",
      b.rejected_rows "rejectedRows",
      p.display_name "createdBy",
      b.created_at "createdAt",
      b.applied_at "appliedAt"
    from erp_supply.analytics_import_batches b
    join erp_supply.profiles p on p.id=b.created_by
    where b.organization_id=v_org
    order by b.created_at desc
    limit v_size offset (v_page-1)*v_size
  ) x;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_analytics_import_preview(
  text,text,text,bigint,text,jsonb
) from public,anon;
revoke all on function public.erp_x_analytics_import_apply(uuid) from public,anon;
revoke all on function public.erp_x_analytics_imports(integer,integer) from public,anon;

grant execute on function public.erp_x_analytics_import_preview(
  text,text,text,bigint,text,jsonb
) to authenticated;
grant execute on function public.erp_x_analytics_import_apply(uuid) to authenticated;
grant execute on function public.erp_x_analytics_imports(integer,integer) to authenticated;

commit;

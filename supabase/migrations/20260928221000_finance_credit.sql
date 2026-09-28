begin;

create or replace function erp_private.finance_append_event(
  p_order_id uuid,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
declare
  v_id uuid;
begin
  insert into erp_supply.financial_events(
    organization_id,order_id,aggregate_type,aggregate_id,event_type,
    actor_profile_id,idempotency_key,payload
  )
  values(
    erp_private.current_org_id(),p_order_id,upper(trim(p_aggregate_type)),p_aggregate_id,
    upper(trim(p_event_type)),erp_private.current_profile_id(),
    nullif(trim(p_idempotency_key),''),coalesce(p_payload,'{}'::jsonb)
  )
  on conflict (organization_id,idempotency_key)
  where idempotency_key is not null
  do update set idempotency_key=excluded.idempotency_key
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function erp_private.finance_append_event(uuid,text,uuid,text,jsonb,text)
from public,anon;
grant execute on function erp_private.finance_append_event(uuid,text,uuid,text,jsonb,text)
to authenticated;

create or replace function public.erp_x_finance_credit_queue(
  p_status text default null,
  p_search text default null,
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
  v_status text:=nullif(upper(trim(coalesce(p_status,''))),'');
  v_search text:=nullif(lower(trim(coalesce(p_search,''))),'');
  v_total bigint;
  v_items jsonb;
  v_actor uuid:=erp_private.current_profile_id();
  v_full_review boolean;
begin
  if not erp_private.can_access_module('credit','read') then
    raise exception 'No autorizado para consultar crédito' using errcode='42501';
  end if;

  v_full_review:=
    erp_private.can_access_module('credit','update')
    or erp_private.can_access_module('credit','approve')
    or erp_private.can_access_module('credit','admin');

  select count(*) into v_total
  from erp_supply.credit_requests c
  join erp_supply.customers customer on customer.id=c.customer_id
  where c.organization_id=v_org
    and (v_full_review or c.requested_by=v_actor)
    and (v_status is null or c.status=v_status)
    and (
      v_search is null
      or lower(c.request_number||' '||customer.display_name||' '||
        coalesce(customer.document,'')||' '||coalesce(c.order_id::text,'')) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'requestNumber',q.request_number,
    'customerId',q.customer_id,
    'customerName',q.customer_name,
    'customerDocument',q.customer_document,
    'orderId',q.order_id,
    'requestedAmount',q.requested_amount,
    'requestedTermDays',q.requested_term_days,
    'status',q.status,
    'requestedBy',q.requested_by_name,
    'assignedTo',q.assigned_to_name,
    'decisionReason',q.decision_reason,
    'createdAt',q.created_at,
    'updatedAt',q.updated_at
  ) order by q.created_at desc),'[]'::jsonb)
  into v_items
  from (
    select
      c.*,
      customer.display_name customer_name,
      customer.document customer_document,
      requested.display_name requested_by_name,
      assigned.display_name assigned_to_name
    from erp_supply.credit_requests c
    join erp_supply.customers customer on customer.id=c.customer_id
    join erp_supply.profiles requested on requested.id=c.requested_by
    left join erp_supply.profiles assigned on assigned.id=c.assigned_to
    where c.organization_id=v_org
      and (v_status is null or c.status=v_status)
      and (
        v_search is null
        or lower(c.request_number||' '||customer.display_name||' '||
          coalesce(customer.document,'')||' '||coalesce(c.order_id::text,'')) like '%'||v_search||'%'
      )
    order by c.created_at desc
    offset (v_page-1)*v_size
    limit v_size
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::int end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_create_credit_request(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_order erp_supply.orders%rowtype;
  v_customer_id uuid:=nullif(p_payload->>'customerId','')::uuid;
  v_order_id uuid:=nullif(p_payload->>'orderId','')::uuid;
  v_amount numeric:=nullif(p_payload->>'requestedAmount','')::numeric;
  v_term integer:=nullif(p_payload->>'requestedTermDays','')::integer;
  v_number text:=nullif(trim(coalesce(p_payload->>'requestNumber','')),'');
  v_request erp_supply.credit_requests%rowtype;
begin
  if not erp_private.can_access_module('credit','create') then
    raise exception 'No autorizado para radicar crédito' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'Idempotency key requerida' using errcode='22023';
  end if;

  select * into v_request
  from erp_supply.credit_requests
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'requestId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if v_order_id is not null then
    select * into v_order
    from erp_supply.orders
    where id=v_order_id and organization_id=v_org;
    if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;
    v_customer_id:=v_order.customer_id;
  end if;

  if v_customer_id is null or not exists(
    select 1 from erp_supply.customers
    where id=v_customer_id and organization_id=v_org
  ) then
    raise exception 'Cliente financiero inválido' using errcode='22023';
  end if;

  if v_amount is null or v_amount<=0 then
    raise exception 'Valor solicitado inválido' using errcode='22023';
  end if;
  if v_term is null or v_term<=0 then
    raise exception 'Plazo solicitado inválido' using errcode='22023';
  end if;

  v_number:=coalesce(v_number,'CR-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));

  insert into erp_supply.credit_requests(
    organization_id,customer_id,order_id,request_number,requested_amount,
    requested_term_days,status,requested_by,idempotency_key,metadata
  )
  values(
    v_org,v_customer_id,v_order_id,v_number,round(v_amount,2),
    v_term,'SUBMITTED',v_actor,trim(p_idempotency_key),
    case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
  )
  returning * into v_request;

  perform erp_private.finance_append_event(
    v_order_id,'CREDIT_REQUEST',v_request.id,'CREDIT_REQUEST_SUBMITTED',
    jsonb_build_object(
      'requestNumber',v_request.request_number,
      'requestedAmount',v_request.requested_amount,
      'requestedTermDays',v_request.requested_term_days
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'requestId',v_request.id,
    'status',v_request.status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_take_credit_request(
  p_request_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_request erp_supply.credit_requests%rowtype;
begin
  if not erp_private.can_access_module('credit','update') then
    raise exception 'No autorizado para tomar solicitudes de crédito' using errcode='42501';
  end if;

  select * into v_request
  from erp_supply.credit_requests
  where id=p_request_id and organization_id=v_org
  for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'requestId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if v_request.status='UNDER_REVIEW' and v_request.assigned_to=v_actor then
    return jsonb_build_object(
      'success',true,'idempotent',true,'requestId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if v_request.status<>'SUBMITTED' then
    raise exception 'La solicitud ya no está disponible para tomar';
  end if;

  update erp_supply.credit_requests
  set status='UNDER_REVIEW',assigned_to=v_actor,updated_at=now()
  where id=v_request.id
  returning * into v_request;

  perform erp_private.finance_append_event(
    v_request.order_id,'CREDIT_REQUEST',v_request.id,'CREDIT_REQUEST_TAKEN',
    jsonb_build_object('assignedTo',v_actor),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'requestId',v_request.id,
    'status',v_request.status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_decide_credit_request(
  p_request_id uuid,
  p_decision text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_decision text:=upper(trim(coalesce(p_decision,'')));
  v_request erp_supply.credit_requests%rowtype;
  v_validation_id uuid;
begin
  if not erp_private.can_access_module('credit','approve') then
    raise exception 'No autorizado para decidir crédito' using errcode='42501';
  end if;
  if v_decision not in ('APPROVED','REJECTED') then
    raise exception 'Decisión de crédito inválida' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'La justificación es obligatoria' using errcode='22023';
  end if;

  select * into v_request
  from erp_supply.credit_requests
  where id=p_request_id and organization_id=v_org
  for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'requestId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if v_request.requested_by=v_actor then
    raise exception 'Quien radica la solicitud no puede aprobarla o rechazarla'
      using errcode='42501';
  end if;

  if v_request.status not in ('SUBMITTED','UNDER_REVIEW') then
    raise exception 'La solicitud ya tiene una decisión final';
  end if;

  update erp_supply.credit_requests
  set status=v_decision,assigned_to=coalesce(assigned_to,v_actor),
      decision_reason=trim(p_reason),decided_by=v_actor,decided_at=now(),updated_at=now()
  where id=v_request.id
  returning * into v_request;

  if v_request.order_id is not null then
    insert into erp_supply.financial_validations(
      organization_id,order_id,validation_type,result,reason,
      actor_profile_id,idempotency_key,metadata
    )
    values(
      v_org,v_request.order_id,'CREDIT',v_decision,trim(p_reason),
      v_actor,trim(p_idempotency_key)||':validation',
      jsonb_build_object(
        'creditRequestId',v_request.id,
        'requestedAmount',v_request.requested_amount,
        'requestedTermDays',v_request.requested_term_days
      )
    )
    returning id into v_validation_id;
  end if;

  perform erp_private.finance_append_event(
    v_request.order_id,'CREDIT_REQUEST',v_request.id,
    case when v_decision='APPROVED' then 'CREDIT_APPROVED' else 'CREDIT_REJECTED' end,
    jsonb_build_object(
      'decisionReason',trim(p_reason),
      'validationId',v_validation_id
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'requestId',v_request.id,
    'status',v_request.status,'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_finance_credit_queue(text,text,integer,integer)
from public,anon;
revoke all on function public.erp_x_finance_create_credit_request(jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_take_credit_request(uuid,text)
from public,anon;
revoke all on function public.erp_x_finance_decide_credit_request(uuid,text,text,text)
from public,anon;

grant execute on function public.erp_x_finance_credit_queue(text,text,integer,integer)
to authenticated;
grant execute on function public.erp_x_finance_create_credit_request(jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_take_credit_request(uuid,text)
to authenticated;
grant execute on function public.erp_x_finance_decide_credit_request(uuid,text,text,text)
to authenticated;

commit;

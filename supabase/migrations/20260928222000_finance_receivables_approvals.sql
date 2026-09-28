begin;

create policy invoices_finance_read
on erp_supply.invoices for select
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('caja','read')
    or erp_private.can_access_module('cartera','read')
    or erp_private.can_access_module('billing','read')
    or erp_private.can_access_module('credit','read')
  )
);

create policy invoices_finance_insert
on erp_supply.invoices for insert
to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and registered_by=erp_private.current_profile_id()
  and (
    erp_private.can_access_module('caja','create')
    or erp_private.can_access_module('billing','create')
  )
);

create policy invoices_finance_update
on erp_supply.invoices for update
to authenticated
using (
  organization_id=erp_private.current_org_id()
  and (
    erp_private.can_access_module('caja','update')
    or erp_private.can_access_module('billing','update')
    or erp_private.can_access_module('caja','approve')
  )
)
with check (organization_id=erp_private.current_org_id());

create or replace function erp_private.finance_invoice_effective_paid(
  p_amount numeric,
  p_reversed_amount numeric,
  p_status text
)
returns numeric
language sql
immutable
security invoker
set search_path=pg_catalog
as $$
  select case upper(coalesce(p_status,''))
    when 'REGISTERED' then greatest(coalesce(p_amount,0),0)
    when 'PARTIALLY_REVERSED' then greatest(coalesce(p_amount,0)-coalesce(p_reversed_amount,0),0)
    else 0::numeric
  end
$$;

create or replace function erp_private.finance_order_paid_total(p_order_id uuid)
returns numeric
language sql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
  select coalesce(sum(erp_private.finance_invoice_effective_paid(
    i.amount,i.reversed_amount,i.status
  )),0)::numeric
  from erp_supply.invoices i
  where i.order_id=p_order_id
    and i.organization_id=erp_private.current_org_id()
$$;

create or replace function erp_private.finance_customer_paid_total(p_customer_id uuid)
returns numeric
language sql
stable
security invoker
set search_path=pg_catalog,erp_supply,erp_private
as $$
  select coalesce(sum(erp_private.finance_invoice_effective_paid(
    i.amount,i.reversed_amount,i.status
  )),0)::numeric
  from erp_supply.orders o
  join erp_supply.invoices i
    on i.organization_id=o.organization_id and i.order_id=o.id
  where o.organization_id=erp_private.current_org_id()
    and o.customer_id=p_customer_id
    and not o.is_test
    and o.status<>'CANCELLED'
$$;

revoke all on function erp_private.finance_invoice_effective_paid(numeric,numeric,text)
from public,anon;
revoke all on function erp_private.finance_order_paid_total(uuid)
from public,anon;
revoke all on function erp_private.finance_customer_paid_total(uuid)
from public,anon;

grant execute on function erp_private.finance_invoice_effective_paid(numeric,numeric,text)
to authenticated;
grant execute on function erp_private.finance_order_paid_total(uuid)
to authenticated;
grant execute on function erp_private.finance_customer_paid_total(uuid)
to authenticated;

create or replace function public.erp_x_finance_queue(
  p_domain text,
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
  v_domain text:=upper(trim(coalesce(p_domain,'')));
  v_status text:=nullif(upper(trim(coalesce(p_status,''))),'');
  v_search text:=nullif(lower(trim(coalesce(p_search,''))),'');
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if v_domain not in ('CARTERA','CAJA') then
    raise exception 'Dominio financiero inválido' using errcode='22023';
  end if;
  if not erp_private.can_access_financial_domain(v_domain,'read') then
    raise exception 'No autorizado para consultar la cola financiera' using errcode='42501';
  end if;

  with candidates as (
    select distinct o.id
    from erp_supply.orders o
    left join erp_supply.financial_holds h
      on h.organization_id=o.organization_id and h.order_id=o.id
      and h.domain=v_domain and h.status='ACTIVE'
    where o.organization_id=v_org
      and not o.is_test
      and (
        (v_domain='CARTERA' and o.current_step_code='CARTERA')
        or
        (v_domain='CAJA' and o.current_step_code in ('CAJA','CAJA_FACTURACION'))
        or h.id is not null
      )
      and (
        v_search is null
        or lower(o.order_number||' '||o.client_name||' '||coalesce(o.client_document,'')) like '%'||v_search||'%'
        or exists(
          select 1 from erp_supply.invoices i
          where i.order_id=o.id and lower(i.invoice_number) like '%'||v_search||'%'
        )
      )
  )
  select count(*) into v_total from candidates;

  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb)
  into v_items
  from (
    select
      o.created_at,
      jsonb_build_object(
        'orderId',o.id,
        'orderNumber',o.order_number,
        'customerId',o.customer_id,
        'customerName',o.client_name,
        'customerDocument',o.client_document,
        'orderType',o.order_type_code,
        'paymentCondition',o.payment_condition_code,
        'currentStep',o.current_step_code,
        'orderStatus',o.status,
        'paidAmount',erp_private.finance_order_paid_total(o.id),
        'activeHold',(
          select jsonb_build_object(
            'id',h.id,'reasonCode',h.reason_code,'reason',h.reason,
            'createdAt',h.created_at,'metadata',h.metadata
          )
          from erp_supply.financial_holds h
          where h.organization_id=v_org and h.order_id=o.id
            and h.domain=v_domain and h.status='ACTIVE'
          order by h.created_at desc limit 1
        ),
        'latestValidation',(
          select jsonb_build_object(
            'id',fv.id,'result',fv.result,'reason',fv.reason,
            'reference',fv.reference,'createdAt',fv.created_at
          )
          from erp_supply.financial_validations fv
          where fv.organization_id=v_org and fv.order_id=o.id
            and fv.validation_type=v_domain
          order by fv.created_at desc,fv.id desc limit 1
        ),
        'invoiceCount',(
          select count(*) from erp_supply.invoices i
          where i.organization_id=v_org and i.order_id=o.id
            and i.status in ('REGISTERED','PARTIALLY_REVERSED')
        )
      ) item
    from erp_supply.orders o
    where o.id in (
      select id
      from (
        select distinct o2.id,o2.created_at
        from erp_supply.orders o2
        left join erp_supply.financial_holds h2
          on h2.organization_id=o2.organization_id and h2.order_id=o2.id
          and h2.domain=v_domain and h2.status='ACTIVE'
        where o2.organization_id=v_org
          and not o2.is_test
          and (
            (v_domain='CARTERA' and o2.current_step_code='CARTERA')
            or
            (v_domain='CAJA' and o2.current_step_code in ('CAJA','CAJA_FACTURACION'))
            or h2.id is not null
          )
          and (
            v_search is null
            or lower(o2.order_number||' '||o2.client_name||' '||coalesce(o2.client_document,'')) like '%'||v_search||'%'
            or exists(
              select 1 from erp_supply.invoices i2
              where i2.order_id=o2.id and lower(i2.invoice_number) like '%'||v_search||'%'
            )
          )
          and (
            v_status is null
            or (v_status='HELD' and h2.id is not null)
            or (v_status='PENDING' and h2.id is null)
          )
        order by o2.created_at desc
        offset (v_page-1)*v_size
        limit v_size
      ) page_rows
    )
  ) rows;

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

create or replace function public.erp_x_finance_validate_order(
  p_order_id uuid,
  p_validation_type text,
  p_result text,
  p_reason text,
  p_reference text,
  p_metadata jsonb,
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
  v_type text:=upper(trim(coalesce(p_validation_type,'')));
  v_result text:=upper(trim(coalesce(p_result,'')));
  v_validation erp_supply.financial_validations%rowtype;
begin
  if v_type not in ('CREDIT','CARTERA','CAJA') then
    raise exception 'Tipo de validación inválido' using errcode='22023';
  end if;
  if v_result not in ('APPROVED','REJECTED','ON_HOLD','REQUIRES_REVIEW','RELEASED') then
    raise exception 'Resultado financiero inválido' using errcode='22023';
  end if;
  if not (
    erp_private.can_access_financial_domain(v_type,'update')
    or erp_private.can_access_financial_domain(v_type,'approve')
  ) then
    raise exception 'No autorizado para registrar validaciones financieras' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'La razón es obligatoria' using errcode='22023';
  end if;
  if not exists(
    select 1 from erp_supply.orders
    where id=p_order_id and organization_id=v_org
  ) then
    raise exception 'Pedido no encontrado' using errcode='22023';
  end if;

  perform erp_private.finance_idempotency_lock('VALIDATION',p_idempotency_key);

  select * into v_validation
  from erp_supply.financial_validations
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'validationId',v_validation.id,
      'result',v_validation.result,'contractVersion','1.0.0'
    );
  end if;

  insert into erp_supply.financial_validations(
    organization_id,order_id,validation_type,result,reason,reference,
    actor_profile_id,idempotency_key,metadata
  )
  values(
    v_org,p_order_id,v_type,v_result,trim(p_reason),
    nullif(trim(coalesce(p_reference,'')),''),
    v_actor,trim(p_idempotency_key),
    case when jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))='object'
      then coalesce(p_metadata,'{}'::jsonb) else '{}'::jsonb end
  )
  returning * into v_validation;

  perform erp_private.finance_append_event(
    p_order_id,'FINANCIAL_VALIDATION',v_validation.id,
    'FINANCIAL_VALIDATION_'||v_result,
    jsonb_build_object(
      'validationType',v_type,'reason',trim(p_reason),
      'reference',v_validation.reference
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'validationId',v_validation.id,
    'result',v_validation.result,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_create_hold(
  p_order_id uuid,
  p_domain text,
  p_reason_code text,
  p_reason text,
  p_metadata jsonb,
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
  v_domain text:=upper(trim(coalesce(p_domain,'')));
  v_hold erp_supply.financial_holds%rowtype;
begin
  if v_domain not in ('CREDIT','CARTERA','CAJA') then
    raise exception 'Dominio financiero inválido' using errcode='22023';
  end if;
  if not erp_private.can_access_financial_domain(v_domain,'update') then
    raise exception 'No autorizado para retener pedidos' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason_code,'')),'') is null
     or nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'Código y razón de retención son obligatorios' using errcode='22023';
  end if;

  perform erp_private.finance_idempotency_lock('HOLD',p_idempotency_key);

  select * into v_hold
  from erp_supply.financial_holds
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'holdId',v_hold.id,
      'status',v_hold.status,'contractVersion','1.0.0'
    );
  end if;

  insert into erp_supply.financial_holds(
    organization_id,order_id,domain,reason_code,reason,status,
    created_by,idempotency_key,metadata
  )
  values(
    v_org,p_order_id,v_domain,upper(trim(p_reason_code)),trim(p_reason),'ACTIVE',
    v_actor,trim(p_idempotency_key),
    case when jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))='object'
      then coalesce(p_metadata,'{}'::jsonb) else '{}'::jsonb end
  )
  returning * into v_hold;

  perform erp_private.finance_append_event(
    p_order_id,'FINANCIAL_HOLD',v_hold.id,'FINANCIAL_HOLD_CREATED',
    jsonb_build_object(
      'domain',v_domain,'reasonCode',v_hold.reason_code,'reason',v_hold.reason
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'holdId',v_hold.id,
    'status',v_hold.status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_release_hold(
  p_hold_id uuid,
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
  v_hold erp_supply.financial_holds%rowtype;
  v_requires_approval boolean;
begin
  select * into v_hold
  from erp_supply.financial_holds
  where id=p_hold_id and organization_id=v_org
  for update;
  if not found then raise exception 'Retención no encontrada' using errcode='22023'; end if;

  if not (
    erp_private.can_access_financial_domain(v_hold.domain,'update')
    or erp_private.can_access_financial_domain(v_hold.domain,'approve')
  ) then
    raise exception 'No autorizado para liberar la retención' using errcode='42501';
  end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'holdId',v_hold.id,
      'status',v_hold.status,'contractVersion','1.0.0'
    );
  end if;

  if v_hold.status='RELEASED' then
    return jsonb_build_object(
      'success',true,'idempotent',true,'holdId',v_hold.id,
      'status',v_hold.status,'contractVersion','1.0.0'
    );
  end if;
  if v_hold.status<>'ACTIVE' then raise exception 'La retención no está activa'; end if;

  v_requires_approval:=coalesce((v_hold.metadata->>'requiresApproval')::boolean,false);
  if v_requires_approval and not exists(
    select 1
    from erp_supply.financial_approval_requests a
    where a.organization_id=v_org and a.hold_id=v_hold.id
      and a.request_type='RELEASE_EXCEPTION' and a.status='APPROVED'
  ) then
    raise exception 'La liberación requiere una aprobación financiera vigente'
      using errcode='42501';
  end if;

  update erp_supply.financial_holds
  set status='RELEASED',released_by=v_actor,released_at=now(),
      release_reason=trim(p_reason)
  where id=v_hold.id
  returning * into v_hold;

  insert into erp_supply.financial_validations(
    organization_id,order_id,validation_type,result,reason,
    actor_profile_id,idempotency_key,metadata
  )
  values(
    v_org,v_hold.order_id,v_hold.domain,'RELEASED',trim(p_reason),
    v_actor,trim(p_idempotency_key)||':validation',
    jsonb_build_object('holdId',v_hold.id)
  );

  perform erp_private.finance_append_event(
    v_hold.order_id,'FINANCIAL_HOLD',v_hold.id,'FINANCIAL_HOLD_RELEASED',
    jsonb_build_object('domain',v_hold.domain,'releaseReason',trim(p_reason)),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'holdId',v_hold.id,
    'status',v_hold.status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_request_exception(
  p_order_id uuid,
  p_hold_id uuid,
  p_request_type text,
  p_reason text,
  p_metadata jsonb,
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
  v_type text:=upper(trim(coalesce(p_request_type,'')));
  v_request erp_supply.financial_approval_requests%rowtype;
begin
  if v_type not in ('CREDIT_EXCEPTION','RELEASE_EXCEPTION','PAYMENT_EXCEPTION') then
    raise exception 'Tipo de excepción financiera inválido' using errcode='22023';
  end if;
  if not (
    erp_private.can_access_module('credit','create')
    or erp_private.can_access_module('cartera','update')
    or erp_private.can_access_module('caja','update')
  ) then
    raise exception 'No autorizado para solicitar excepciones financieras' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'La justificación es obligatoria' using errcode='22023';
  end if;

  perform erp_private.finance_idempotency_lock('APPROVAL_REQUEST',p_idempotency_key);

  select * into v_request
  from erp_supply.financial_approval_requests
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'approvalId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if p_hold_id is not null and not exists(
    select 1 from erp_supply.financial_holds
    where id=p_hold_id and organization_id=v_org and order_id=p_order_id
  ) then
    raise exception 'La retención no pertenece al pedido' using errcode='22023';
  end if;

  insert into erp_supply.financial_approval_requests(
    organization_id,order_id,hold_id,request_type,status,requested_by,
    reason,idempotency_key,metadata
  )
  values(
    v_org,p_order_id,p_hold_id,v_type,'PENDING',v_actor,trim(p_reason),
    trim(p_idempotency_key),
    case when jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))='object'
      then coalesce(p_metadata,'{}'::jsonb) else '{}'::jsonb end
  )
  returning * into v_request;

  perform erp_private.finance_append_event(
    p_order_id,'FINANCIAL_APPROVAL',v_request.id,'FINANCIAL_EXCEPTION_REQUESTED',
    jsonb_build_object('requestType',v_type,'reason',trim(p_reason),'holdId',p_hold_id),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'approvalId',v_request.id,
    'status',v_request.status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_decide_exception(
  p_approval_id uuid,
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
  v_request erp_supply.financial_approval_requests%rowtype;
begin
  if v_decision not in ('APPROVED','REJECTED') then
    raise exception 'Decisión inválida' using errcode='22023';
  end if;
  if not (
    erp_private.can_access_module('approvals','approve')
    or erp_private.can_access_module('credit','approve')
    or erp_private.can_access_module('cartera','approve')
    or erp_private.can_access_module('caja','approve')
  ) then
    raise exception 'No autorizado para decidir excepciones financieras' using errcode='42501';
  end if;

  select * into v_request
  from erp_supply.financial_approval_requests
  where id=p_approval_id and organization_id=v_org
  for update;
  if not found then raise exception 'Solicitud de aprobación no encontrada' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'approvalId',v_request.id,
      'status',v_request.status,'contractVersion','1.0.0'
    );
  end if;

  if v_request.requested_by=v_actor then
    raise exception 'Quien solicita una excepción no puede decidirla' using errcode='42501';
  end if;
  if v_request.status<>'PENDING' then
    raise exception 'La solicitud ya tiene decisión';
  end if;

  update erp_supply.financial_approval_requests
  set status=v_decision,decided_by=v_actor,decision_reason=trim(p_reason),decided_at=now()
  where id=v_request.id
  returning * into v_request;

  perform erp_private.finance_append_event(
    v_request.order_id,'FINANCIAL_APPROVAL',v_request.id,
    case when v_decision='APPROVED' then 'FINANCIAL_EXCEPTION_APPROVED'
      else 'FINANCIAL_EXCEPTION_REJECTED' end,
    jsonb_build_object(
      'requestType',v_request.request_type,
      'decisionReason',trim(p_reason),'holdId',v_request.hold_id
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'approvalId',v_request.id,
    'status',v_request.status,'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_finance_queue(text,text,text,integer,integer)
from public,anon;
revoke all on function public.erp_x_finance_validate_order(uuid,text,text,text,text,jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_create_hold(uuid,text,text,text,jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_release_hold(uuid,text,text)
from public,anon;
revoke all on function public.erp_x_finance_request_exception(uuid,uuid,text,text,jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_decide_exception(uuid,text,text,text)
from public,anon;

grant execute on function public.erp_x_finance_queue(text,text,text,integer,integer)
to authenticated;
grant execute on function public.erp_x_finance_validate_order(uuid,text,text,text,text,jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_create_hold(uuid,text,text,text,jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_release_hold(uuid,text,text)
to authenticated;
grant execute on function public.erp_x_finance_request_exception(uuid,uuid,text,text,jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_decide_exception(uuid,text,text,text)
to authenticated;

commit;

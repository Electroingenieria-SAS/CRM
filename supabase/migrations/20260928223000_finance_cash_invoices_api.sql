begin;

create or replace function public.erp_x_finance_add_support(
  p_order_id uuid,
  p_invoice_id uuid,
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
  v_support erp_supply.financial_supports%rowtype;
begin
  if not erp_private.can_access_module('caja','create') then
    raise exception 'No autorizado para registrar soportes de pago' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_payload->>'supportType','')),'') is null
     or nullif(trim(coalesce(p_payload->>'storageProvider','')),'') is null
     or nullif(trim(coalesce(p_payload->>'storageReference','')),'') is null then
    raise exception 'Tipo, proveedor y referencia del soporte son obligatorios' using errcode='22023';
  end if;

  select * into v_support
  from erp_supply.financial_supports
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'supportId',v_support.id,
      'status',v_support.validation_status,'contractVersion','1.0.0'
    );
  end if;

  if not exists(
    select 1 from erp_supply.orders
    where id=p_order_id and organization_id=v_org
  ) then
    raise exception 'Pedido no encontrado' using errcode='22023';
  end if;

  if p_invoice_id is not null and not exists(
    select 1 from erp_supply.invoices
    where id=p_invoice_id and organization_id=v_org and order_id=p_order_id
  ) then
    raise exception 'La factura no pertenece al pedido' using errcode='22023';
  end if;

  insert into erp_supply.financial_supports(
    organization_id,order_id,invoice_id,support_type,storage_provider,storage_reference,
    file_name,mime_type,size_bytes,created_by,idempotency_key,metadata
  )
  values(
    v_org,p_order_id,p_invoice_id,
    upper(trim(p_payload->>'supportType')),
    upper(trim(p_payload->>'storageProvider')),
    trim(p_payload->>'storageReference'),
    nullif(trim(coalesce(p_payload->>'fileName','')),''),
    nullif(trim(coalesce(p_payload->>'mimeType','')),''),
    nullif(p_payload->>'sizeBytes','')::bigint,
    v_actor,trim(p_idempotency_key),
    case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
  )
  returning * into v_support;

  perform erp_private.finance_append_event(
    p_order_id,'FINANCIAL_SUPPORT',v_support.id,'PAYMENT_SUPPORT_REGISTERED',
    jsonb_build_object(
      'supportType',v_support.support_type,
      'storageProvider',v_support.storage_provider,
      'invoiceId',v_support.invoice_id
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'supportId',v_support.id,
    'status',v_support.validation_status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_validate_support(
  p_support_id uuid,
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
  v_support erp_supply.financial_supports%rowtype;
begin
  if not erp_private.can_access_module('caja','update') then
    raise exception 'No autorizado para validar soportes' using errcode='42501';
  end if;
  if v_decision not in ('VALIDATED','REJECTED') then
    raise exception 'Decisión de soporte inválida' using errcode='22023';
  end if;

  select * into v_support
  from erp_supply.financial_supports
  where id=p_support_id and organization_id=v_org
  for update;
  if not found then raise exception 'Soporte no encontrado' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'supportId',v_support.id,
      'status',v_support.validation_status,'contractVersion','1.0.0'
    );
  end if;

  if v_support.validation_status<>'PENDING' then
    raise exception 'El soporte ya fue validado';
  end if;

  update erp_supply.financial_supports
  set validation_status=v_decision,validated_by=v_actor,validated_at=now(),
      validation_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=v_support.id
  returning * into v_support;

  perform erp_private.finance_append_event(
    v_support.order_id,'FINANCIAL_SUPPORT',v_support.id,
    case when v_decision='VALIDATED' then 'PAYMENT_SUPPORT_VALIDATED'
      else 'PAYMENT_SUPPORT_REJECTED' end,
    jsonb_build_object('reason',v_support.validation_reason),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'supportId',v_support.id,
    'status',v_support.validation_status,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_register_invoice(
  p_order_id uuid,
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
  v_invoice erp_supply.invoices%rowtype;
  v_number text:=nullif(trim(coalesce(p_payload->>'invoiceNumber','')),'');
  v_amount numeric:=nullif(p_payload->>'amount','')::numeric;
  v_currency text:=upper(coalesce(nullif(trim(p_payload->>'currency'),''),'COP'));
  v_support_id uuid:=nullif(p_payload->>'supportId','')::uuid;
begin
  if not (
    erp_private.can_access_module('caja','create')
    or erp_private.can_access_module('billing','create')
  ) then
    raise exception 'No autorizado para registrar facturas' using errcode='42501';
  end if;

  select * into v_invoice
  from erp_supply.invoices
  where organization_id=v_org and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if found then
    return jsonb_build_object(
      'success',true,'idempotent',true,'invoiceId',v_invoice.id,
      'status',v_invoice.status,'paidAmount',
      erp_private.finance_invoice_effective_paid(
        v_invoice.amount,v_invoice.reversed_amount,v_invoice.status
      ),
      'contractVersion','1.0.0'
    );
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org
  for share;
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  if v_number is null then raise exception 'Número de factura requerido' using errcode='22023'; end if;
  if v_amount is null or v_amount<=0 then
    raise exception 'Valor pagado documentado inválido' using errcode='22023';
  end if;
  if v_currency<>'COP' then
    raise exception 'El dominio financiero auditado actualmente opera únicamente en COP'
      using errcode='22023';
  end if;

  if v_support_id is not null and not exists(
    select 1 from erp_supply.financial_supports
    where id=v_support_id and organization_id=v_org and order_id=p_order_id
      and validation_status='VALIDATED'
  ) then
    raise exception 'El soporte asociado debe pertenecer al pedido y estar validado'
      using errcode='22023';
  end if;

  insert into erp_supply.invoices(
    organization_id,order_id,invoice_number,invoice_date,amount,reversed_amount,
    currency,status,registered_by,idempotency_key,updated_by,metadata
  )
  values(
    v_org,p_order_id,v_number,
    coalesce(nullif(p_payload->>'invoiceDate','')::date,current_date),
    round(v_amount,2),0,'COP','REGISTERED',v_actor,trim(p_idempotency_key),v_actor,
    (
      case when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
        then coalesce(p_payload->'metadata','{}'::jsonb) else '{}'::jsonb end
    )||jsonb_build_object(
      'paymentTruth','REGISTERED_INVOICE',
      'supportId',v_support_id,
      'financeContractVersion','1.0.0'
    )
  )
  returning * into v_invoice;

  if v_support_id is not null then
    update erp_supply.financial_supports
    set invoice_id=v_invoice.id
    where id=v_support_id;
  end if;

  perform erp_private.finance_append_event(
    p_order_id,'INVOICE',v_invoice.id,'INVOICE_REGISTERED',
    jsonb_build_object(
      'invoiceNumber',v_invoice.invoice_number,
      'paidAmount',v_invoice.amount,
      'currency',v_invoice.currency,
      'supportId',v_support_id
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'invoiceId',v_invoice.id,
    'status',v_invoice.status,'paidAmount',v_invoice.amount,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_reverse_invoice(
  p_invoice_id uuid,
  p_amount numeric,
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
  v_invoice erp_supply.invoices%rowtype;
  v_remaining numeric;
  v_new_reversed numeric;
begin
  if not (
    erp_private.can_access_module('caja','approve')
    or erp_private.can_access_module('approvals','approve')
  ) then
    raise exception 'El reverso requiere autoridad de aprobación financiera'
      using errcode='42501';
  end if;
  if p_amount is null or p_amount<=0 then
    raise exception 'Valor de reverso inválido' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'El motivo del reverso es obligatorio' using errcode='22023';
  end if;

  select * into v_invoice
  from erp_supply.invoices
  where id=p_invoice_id and organization_id=v_org
  for update;
  if not found then raise exception 'Factura no encontrada' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'invoiceId',v_invoice.id,
      'status',v_invoice.status,
      'paidAmount',erp_private.finance_invoice_effective_paid(
        v_invoice.amount,v_invoice.reversed_amount,v_invoice.status
      ),
      'contractVersion','1.0.0'
    );
  end if;

  if v_invoice.status in ('REVERSED','VOID') then
    raise exception 'La factura ya no admite reversos';
  end if;

  v_remaining:=v_invoice.amount-v_invoice.reversed_amount;
  if p_amount>v_remaining then
    raise exception 'El reverso supera el valor pagado pendiente de reversar'
      using errcode='22023';
  end if;

  v_new_reversed:=round(v_invoice.reversed_amount+p_amount,2);

  update erp_supply.invoices
  set reversed_amount=v_new_reversed,
      status=case when v_new_reversed=amount then 'REVERSED' else 'PARTIALLY_REVERSED' end,
      reversal_reason=trim(p_reason),reversed_at=now(),reversed_by=v_actor,
      updated_at=now(),updated_by=v_actor
  where id=v_invoice.id
  returning * into v_invoice;

  perform erp_private.finance_append_event(
    v_invoice.order_id,'INVOICE',v_invoice.id,'INVOICE_PAYMENT_REVERSED',
    jsonb_build_object(
      'reversalAmount',round(p_amount,2),
      'totalReversed',v_invoice.reversed_amount,
      'remainingPaid',erp_private.finance_invoice_effective_paid(
        v_invoice.amount,v_invoice.reversed_amount,v_invoice.status
      ),
      'reason',trim(p_reason)
    ),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'invoiceId',v_invoice.id,
    'status',v_invoice.status,
    'paidAmount',erp_private.finance_invoice_effective_paid(
      v_invoice.amount,v_invoice.reversed_amount,v_invoice.status
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_void_invoice(
  p_invoice_id uuid,
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
  v_invoice erp_supply.invoices%rowtype;
begin
  if not (
    erp_private.can_access_module('caja','approve')
    or erp_private.can_access_module('approvals','approve')
  ) then
    raise exception 'La anulación requiere autoridad de aprobación financiera'
      using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'El motivo de anulación es obligatorio' using errcode='22023';
  end if;

  select * into v_invoice
  from erp_supply.invoices
  where id=p_invoice_id and organization_id=v_org
  for update;
  if not found then raise exception 'Factura no encontrada' using errcode='22023'; end if;

  if exists(
    select 1 from erp_supply.financial_events
    where organization_id=v_org and idempotency_key=trim(p_idempotency_key)||':event'
  ) then
    return jsonb_build_object(
      'success',true,'idempotent',true,'invoiceId',v_invoice.id,
      'status',v_invoice.status,'paidAmount',0,'contractVersion','1.0.0'
    );
  end if;

  if v_invoice.status<>'REGISTERED' or v_invoice.reversed_amount<>0 then
    raise exception 'Solo una factura registrada sin reversos puede anularse';
  end if;

  update erp_supply.invoices
  set status='VOID',void_reason=trim(p_reason),voided_by=v_actor,voided_at=now(),
      updated_by=v_actor,updated_at=now()
  where id=v_invoice.id
  returning * into v_invoice;

  perform erp_private.finance_append_event(
    v_invoice.order_id,'INVOICE',v_invoice.id,'INVOICE_VOIDED',
    jsonb_build_object('reason',trim(p_reason)),
    trim(p_idempotency_key)||':event'
  );

  return jsonb_build_object(
    'success',true,'idempotent',false,'invoiceId',v_invoice.id,
    'status',v_invoice.status,'paidAmount',0,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_order_summary(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_paid numeric;
  v_credit erp_supply.credit_requests%rowtype;
begin
  if not (
    erp_private.can_access_module('orders','read')
    or erp_private.can_access_module('credit','read')
    or erp_private.can_access_module('cartera','read')
    or erp_private.can_access_module('caja','read')
  ) then
    raise exception 'No autorizado para consultar el resumen financiero'
      using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org;
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  v_paid:=erp_private.finance_order_paid_total(v_order.id);

  select * into v_credit
  from erp_supply.credit_requests
  where organization_id=v_org and order_id=v_order.id
  order by created_at desc limit 1;

  return jsonb_build_object(
    'orderId',v_order.id,
    'orderNumber',v_order.order_number,
    'paymentCondition',v_order.payment_condition_code,
    'paidAmount',v_paid,
    'paymentTruth','REGISTERED_INVOICES_NET_OF_REVERSALS',
    'credit',case when v_credit.id is null then null else jsonb_build_object(
      'requestId',v_credit.id,
      'requestNumber',v_credit.request_number,
      'requestedAmount',v_credit.requested_amount,
      'requestedTermDays',v_credit.requested_term_days,
      'status',v_credit.status,
      'balanceAgainstRequestedAmount',
        greatest(v_credit.requested_amount-v_paid,0)
    ) end,
    'availableCredit',null,
    'availableCreditReason','NO_AUDITED_REUSABLE_CREDIT_LIMIT',
    'activeHolds',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',h.id,'domain',h.domain,'reasonCode',h.reason_code,
        'reason',h.reason,'createdAt',h.created_at,'metadata',h.metadata
      ) order by h.created_at desc),'[]'::jsonb)
      from erp_supply.financial_holds h
      where h.organization_id=v_org and h.order_id=v_order.id and h.status='ACTIVE'
    ),
    'validations',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',fv.id,'type',fv.validation_type,'result',fv.result,
        'reason',fv.reason,'reference',fv.reference,'createdAt',fv.created_at
      ) order by fv.created_at desc),'[]'::jsonb)
      from erp_supply.financial_validations fv
      where fv.organization_id=v_org and fv.order_id=v_order.id
    ),
    'invoices',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',i.id,'invoiceNumber',i.invoice_number,'invoiceDate',i.invoice_date,
        'amount',i.amount,'reversedAmount',i.reversed_amount,
        'paidAmount',erp_private.finance_invoice_effective_paid(
          i.amount,i.reversed_amount,i.status
        ),
        'currency',i.currency,'status',i.status,'createdAt',i.created_at
      ) order by i.invoice_date desc,i.created_at desc),'[]'::jsonb)
      from erp_supply.invoices i
      where i.organization_id=v_org and i.order_id=v_order.id
    ),
    'supports',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',s.id,'invoiceId',s.invoice_id,'supportType',s.support_type,
        'storageProvider',s.storage_provider,'storageReference',s.storage_reference,
        'validationStatus',s.validation_status,'createdAt',s.created_at
      ) order by s.created_at desc),'[]'::jsonb)
      from erp_supply.financial_supports s
      where s.organization_id=v_org and s.order_id=v_order.id
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_financial_gate(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_order erp_supply.orders%rowtype;
  v_hold erp_supply.financial_holds%rowtype;
  v_domain text;
  v_validation erp_supply.financial_validations%rowtype;
begin
  if not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar el gate financiero' using errcode='42501';
  end if;

  select * into v_order
  from erp_supply.orders
  where id=p_order_id and organization_id=v_org;
  if not found then raise exception 'Pedido no encontrado' using errcode='22023'; end if;

  select * into v_hold
  from erp_supply.financial_holds
  where organization_id=v_org and order_id=v_order.id and status='ACTIVE'
  order by created_at desc limit 1;

  if v_hold.id is not null then
    return jsonb_build_object(
      'decision','ON_HOLD','domain',v_hold.domain,
      'reason',v_hold.reason,'holdId',v_hold.id,
      'nextActorModule',lower(v_hold.domain),
      'contractVersion','1.0.0'
    );
  end if;

  v_domain:=case
    when v_order.current_step_code='CARTERA' then 'CARTERA'
    when v_order.current_step_code in ('CAJA','CAJA_FACTURACION') then 'CAJA'
    else null
  end;

  if v_domain is null then
    return jsonb_build_object(
      'decision','APPROVED','domain',null,
      'reason','No existe una retención financiera activa para el estado actual.',
      'nextActorModule',null,'contractVersion','1.0.0'
    );
  end if;

  select * into v_validation
  from erp_supply.financial_validations
  where organization_id=v_org and order_id=v_order.id and validation_type=v_domain
  order by created_at desc,id desc limit 1;

  if v_validation.id is null then
    return jsonb_build_object(
      'decision','REQUIRES_REVIEW','domain',v_domain,
      'reason','El pedido requiere una decisión financiera antes de avanzar.',
      'nextActorModule',lower(v_domain),'contractVersion','1.0.0'
    );
  end if;

  return jsonb_build_object(
    'decision',case
      when v_validation.result in ('APPROVED','RELEASED') then 'RELEASED'
      when v_validation.result='REJECTED' then 'REJECTED'
      when v_validation.result='ON_HOLD' then 'ON_HOLD'
      else 'REQUIRES_REVIEW'
    end,
    'domain',v_domain,'reason',v_validation.reason,
    'validationId',v_validation.id,
    'nextActorModule',case
      when v_validation.result in ('APPROVED','RELEASED') then null
      else lower(v_domain)
    end,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_finance_customer_paid(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
begin
  if not (
    erp_private.can_access_module('customer_intelligence','read')
    or erp_private.can_access_module('credit','read')
    or erp_private.can_access_module('cartera','read')
    or erp_private.can_access_module('caja','read')
  ) then
    raise exception 'No autorizado para consultar valor pagado' using errcode='42501';
  end if;

  if not exists(
    select 1 from erp_supply.customers
    where id=p_customer_id and organization_id=v_org
  ) then
    raise exception 'Cliente no encontrado' using errcode='22023';
  end if;

  return jsonb_build_object(
    'customerId',p_customer_id,
    'totalPaid',erp_private.finance_customer_paid_total(p_customer_id),
    'invoiceCount',(
      select count(*)
      from erp_supply.orders o
      join erp_supply.invoices i
        on i.organization_id=o.organization_id and i.order_id=o.id
      where o.organization_id=v_org and o.customer_id=p_customer_id
        and i.status in ('REGISTERED','PARTIALLY_REVERSED')
    ),
    'source','REGISTERED_INVOICES_NET_OF_REVERSALS',
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_finance_add_support(uuid,uuid,jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_validate_support(uuid,text,text,text)
from public,anon;
revoke all on function public.erp_x_finance_register_invoice(uuid,jsonb,text)
from public,anon;
revoke all on function public.erp_x_finance_reverse_invoice(uuid,numeric,text,text)
from public,anon;
revoke all on function public.erp_x_finance_void_invoice(uuid,text,text)
from public,anon;
revoke all on function public.erp_x_finance_order_summary(uuid)
from public,anon;
revoke all on function public.erp_x_financial_gate(uuid)
from public,anon;
revoke all on function public.erp_x_finance_customer_paid(uuid)
from public,anon;

grant execute on function public.erp_x_finance_add_support(uuid,uuid,jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_validate_support(uuid,text,text,text)
to authenticated;
grant execute on function public.erp_x_finance_register_invoice(uuid,jsonb,text)
to authenticated;
grant execute on function public.erp_x_finance_reverse_invoice(uuid,numeric,text,text)
to authenticated;
grant execute on function public.erp_x_finance_void_invoice(uuid,text,text)
to authenticated;
grant execute on function public.erp_x_finance_order_summary(uuid)
to authenticated;
grant execute on function public.erp_x_financial_gate(uuid)
to authenticated;
grant execute on function public.erp_x_finance_customer_paid(uuid)
to authenticated;

commit;

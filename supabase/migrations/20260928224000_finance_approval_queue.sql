begin;

create or replace function public.erp_x_finance_approval_queue(
  p_status text default 'PENDING',
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
  v_status text:=nullif(upper(trim(coalesce(p_status,''))),'');
  v_search text:=nullif(lower(trim(coalesce(p_search,''))),'');
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if not erp_private.can_access_module('approvals','read') then
    raise exception 'No autorizado para consultar aprobaciones financieras' using errcode='42501';
  end if;

  select count(*) into v_total
  from erp_supply.financial_approval_requests a
  join erp_supply.orders o on o.id=a.order_id and o.organization_id=a.organization_id
  join erp_supply.profiles requester on requester.id=a.requested_by
  where a.organization_id=v_org
    and (v_status is null or a.status=v_status)
    and (
      v_search is null
      or lower(o.order_number||' '||o.client_name||' '||a.request_type||' '||requester.display_name)
        like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'orderId',q.order_id,'orderNumber',q.order_number,
    'customerName',q.client_name,'holdId',q.hold_id,
    'requestType',q.request_type,'status',q.status,'reason',q.reason,
    'requestedById',q.requested_by,'requestedBy',q.requested_by_name,
    'decidedBy',q.decided_by_name,'decisionReason',q.decision_reason,
    'createdAt',q.created_at,'decidedAt',q.decided_at
  ) order by q.created_at desc),'[]'::jsonb)
  into v_items
  from (
    select
      a.*,o.order_number,o.client_name,
      requester.display_name requested_by_name,
      decider.display_name decided_by_name
    from erp_supply.financial_approval_requests a
    join erp_supply.orders o on o.id=a.order_id and o.organization_id=a.organization_id
    join erp_supply.profiles requester on requester.id=a.requested_by
    left join erp_supply.profiles decider on decider.id=a.decided_by
    where a.organization_id=v_org
      and (v_status is null or a.status=v_status)
      and (
        v_search is null
        or lower(o.order_number||' '||o.client_name||' '||a.request_type||' '||requester.display_name)
          like '%'||v_search||'%'
      )
    order by a.created_at desc
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

revoke all on function public.erp_x_finance_approval_queue(text,text,integer,integer)
from public,anon;
grant execute on function public.erp_x_finance_approval_queue(text,text,integer,integer)
to authenticated;

commit;

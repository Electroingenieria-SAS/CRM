begin;

create or replace function public.erp_x_supply_queue(
  p_area text,p_status text default null,p_search text default null,
  p_page integer default 1,p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_area text:=upper(btrim(p_area));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if v_area not in ('PURCHASING','RECEIVING','PICKING','CUTTING') then
    raise exception 'Área operativa inválida' using errcode='22023';
  end if;

  if not erp_private.can_access_module(
    case v_area when 'PURCHASING' then 'purchasing' when 'RECEIVING' then 'receiving'
      when 'PICKING' then 'picking' else 'cutting' end,'read'
  ) then raise exception 'No autorizado para consultar esta cola' using errcode='42501'; end if;

  with rows as (
    select r.id,'PURCHASING'::text area,r.order_id,o.order_number,o.client_name,r.status,
      null::text reference,null::text assigned_to,r.requested_at updated_at
    from erp_supply.purchase_requests r join erp_supply.orders o on o.id=r.order_id
    where v_area='PURCHASING'
    union all
    select gr.id,'RECEIVING',gr.order_id,o.order_number,o.client_name,gr.status,
      gr.document_reference,p.display_name,gr.received_at
    from erp_supply.goods_receipts gr
    left join erp_supply.orders o on o.id=gr.order_id
    left join erp_supply.profiles p on p.id=gr.received_by
    where v_area='RECEIVING'
    union all
    select j.id,'PICKING',j.order_id,o.order_number,o.client_name,j.status,
      null,p.display_name,coalesce(j.completed_at,j.started_at,j.created_at)
    from erp_supply.picking_jobs j
    join erp_supply.orders o on o.id=j.order_id
    left join erp_supply.profiles p on p.id=j.assigned_profile_id
    where v_area='PICKING'
    union all
    select j.id,'CUTTING',j.order_id,o.order_number,o.client_name,j.status,
      null,p.display_name,coalesce(j.completed_at,j.started_at,j.created_at)
    from erp_supply.cutting_jobs j
    join erp_supply.orders o on o.id=j.order_id
    left join erp_supply.profiles p on p.id=j.assigned_profile_id
    where v_area='CUTTING'
  ), filtered as (
    select * from rows
    where (nullif(btrim(coalesce(p_status,'')),'') is null or status=upper(btrim(p_status)))
      and (
        nullif(btrim(coalesce(p_search,'')),'') is null
        or lower(coalesce(order_number,'')||' '||coalesce(client_name,'')||' '||coalesce(reference,'')) like '%'||lower(btrim(p_search))||'%'
      )
  )
  select count(*) into v_total from filtered;

  with rows as (
    select r.id,'PURCHASING'::text area,r.order_id,o.order_number,o.client_name,r.status,
      null::text reference,null::text assigned_to,r.requested_at updated_at
    from erp_supply.purchase_requests r join erp_supply.orders o on o.id=r.order_id
    where v_area='PURCHASING'
    union all
    select gr.id,'RECEIVING',gr.order_id,o.order_number,o.client_name,gr.status,
      gr.document_reference,p.display_name,gr.received_at
    from erp_supply.goods_receipts gr
    left join erp_supply.orders o on o.id=gr.order_id
    left join erp_supply.profiles p on p.id=gr.received_by
    where v_area='RECEIVING'
    union all
    select j.id,'PICKING',j.order_id,o.order_number,o.client_name,j.status,
      null,p.display_name,coalesce(j.completed_at,j.started_at,j.created_at)
    from erp_supply.picking_jobs j join erp_supply.orders o on o.id=j.order_id
    left join erp_supply.profiles p on p.id=j.assigned_profile_id
    where v_area='PICKING'
    union all
    select j.id,'CUTTING',j.order_id,o.order_number,o.client_name,j.status,
      null,p.display_name,coalesce(j.completed_at,j.started_at,j.created_at)
    from erp_supply.cutting_jobs j join erp_supply.orders o on o.id=j.order_id
    left join erp_supply.profiles p on p.id=j.assigned_profile_id
    where v_area='CUTTING'
  ), filtered as (
    select * from rows
    where (nullif(btrim(coalesce(p_status,'')),'') is null or status=upper(btrim(p_status)))
      and (
        nullif(btrim(coalesce(p_search,'')),'') is null
        or lower(coalesce(order_number,'')||' '||coalesce(client_name,'')||' '||coalesce(reference,'')) like '%'||lower(btrim(p_search))||'%'
      )
    order by updated_at desc
    offset (v_page-1)*v_size limit v_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'area',area,'orderId',order_id,'orderNumber',order_number,'clientName',client_name,
    'status',status,'reference',reference,'assignedTo',assigned_to,'updatedAt',updated_at
  ) order by updated_at desc),'[]'::jsonb)
  into v_items from filtered;

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

revoke all on function public.erp_x_supply_queue(text,text,text,integer,integer) from public,anon;
grant execute on function public.erp_x_supply_queue(text,text,text,integer,integer) to authenticated;

commit;

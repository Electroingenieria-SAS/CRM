begin;

create or replace function public.erp_x_inventory_submit_count(
  p_balance_id uuid,
  p_counted_quantity numeric,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_balance erp_supply.inventory_balances%rowtype;
  v_operation erp_supply.inventory_operations%rowtype;
  v_count uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('create');
  if p_counted_quantity is null or p_counted_quantity<0 then
    raise exception 'El conteo físico no puede ser negativo' using errcode='22023';
  end if;

  v_operation:=erp_private.inventory_begin_operation('COUNT_SUBMIT',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  select * into v_balance
  from erp_supply.inventory_balances b
  where b.id=p_balance_id and b.organization_id=v_org
  for share;
  if not found then raise exception 'Saldo a contar no disponible' using errcode='22023'; end if;

  insert into erp_supply.inventory_counts(
    organization_id,balance_id,material_id,variant_id,location_id,
    counted_quantity,theoretical_quantity,difference,blind,submitted_by,metadata
  ) values(
    v_org,v_balance.id,v_balance.material_id,v_balance.variant_id,v_balance.location_id,
    p_counted_quantity,v_balance.on_hand,p_counted_quantity-v_balance.on_hand,true,v_actor,
    jsonb_build_object('note',nullif(btrim(coalesce(p_note,'')),''))
  )
  returning id into v_count;

  v_result:=jsonb_build_object(
    'countId',v_count,'status','SUBMITTED','blind',true,'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_review_count(
  p_count_id uuid,
  p_decision text,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_count erp_supply.inventory_counts%rowtype;
  v_balance erp_supply.inventory_balances%rowtype;
  v_material erp_supply.material_master%rowtype;
  v_operation erp_supply.inventory_operations%rowtype;
  v_decision text:=upper(btrim(coalesce(p_decision,'')));
  v_status text;
  v_movement uuid;
  v_result jsonb;
begin
  perform erp_private.inventory_require('approve');
  if v_decision not in('APPROVE','RECOUNT','REJECT') then
    raise exception 'Decisión de conteo inválida' using errcode='22023';
  end if;
  if btrim(coalesce(p_note,''))='' then
    raise exception 'La revisión del conteo requiere una nota' using errcode='22023';
  end if;

  v_operation:=erp_private.inventory_begin_operation('COUNT_REVIEW',p_idempotency_key);
  if v_operation.result is not null then return v_operation.result; end if;

  select * into v_count
  from erp_supply.inventory_counts c
  where c.id=p_count_id and c.organization_id=v_org and c.status='SUBMITTED'
  for update;
  if not found then raise exception 'Conteo no disponible para revisión' using errcode='22023'; end if;

  select * into v_balance
  from erp_supply.inventory_balances b
  where b.id=v_count.balance_id and b.organization_id=v_org
  for update;

  if v_decision='APPROVE' and v_balance.on_hand<>v_count.theoretical_quantity then
    v_status:='RECOUNT_REQUIRED';
  elsif v_decision='RECOUNT' then
    v_status:='RECOUNT_REQUIRED';
  elsif v_decision='REJECT' then
    v_status:='REJECTED';
  else
    v_status:='APPLIED';
    if v_count.difference<>0 then
      select * into v_material from erp_supply.material_master where id=v_count.material_id;
      v_movement:=erp_private.inventory_apply_delta(
        v_operation.id,v_count.material_id,v_count.variant_id,v_count.location_id,
        null,null,v_count.id,
        case when v_count.difference>0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end,
        abs(v_count.difference),v_material.unit,v_count.difference,0,0,
        'PHYSICAL_COUNT',btrim(p_note),
        jsonb_build_object('countId',v_count.id,'blind',v_count.blind),null
      );
    end if;
  end if;

  update erp_supply.inventory_counts
  set status=v_status,reviewed_by=v_actor,reviewed_at=now(),review_note=btrim(p_note)
  where id=v_count.id;

  v_result:=jsonb_build_object(
    'countId',v_count.id,'status',v_status,'movementId',v_movement,'contractVersion','1.0.0'
  );
  perform erp_private.inventory_finish_operation(v_operation.id,v_result);
  return v_result;
end;
$$;

create or replace function public.erp_x_inventory_counts(
  p_status text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,25),1),100);
  v_total integer;
  v_items jsonb;
  v_controller boolean:=erp_private.can_access_module('inventory','approve');
begin
  perform erp_private.inventory_require('read');

  select count(*) into v_total
  from erp_supply.inventory_counts c
  where c.organization_id=v_org and (p_status is null or c.status=upper(p_status));

  select coalesce(jsonb_agg(to_jsonb(x) order by x."submittedAt" desc),'[]'::jsonb)
  into v_items
  from (
    select
      c.id "countId",
      m.reference,
      m.name,
      v.label "variantLabel",
      l.code "locationCode",
      c.counted_quantity "countedQuantity",
      case when v_controller then c.theoretical_quantity else null end "theoreticalQuantity",
      case when v_controller then c.difference else null end difference,
      c.blind,
      c.status,
      p.display_name "submittedBy",
      c.submitted_at "submittedAt",
      c.review_note "reviewNote"
    from erp_supply.inventory_counts c
    join erp_supply.material_master m on m.id=c.material_id
    left join erp_supply.material_variants v on v.id=c.variant_id
    join erp_supply.inventory_locations l on l.id=c.location_id
    join erp_supply.profiles p on p.id=c.submitted_by
    where c.organization_id=v_org and (p_status is null or c.status=upper(p_status))
    order by c.submitted_at desc,c.id desc
    offset (v_page-1)*v_size
    limit v_size
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

revoke all on function public.erp_x_inventory_submit_count(uuid,numeric,text,text) from public,anon;
revoke all on function public.erp_x_inventory_review_count(uuid,text,text,text) from public,anon;
revoke all on function public.erp_x_inventory_counts(text,integer,integer) from public,anon;

grant execute on function public.erp_x_inventory_submit_count(uuid,numeric,text,text) to authenticated;
grant execute on function public.erp_x_inventory_review_count(uuid,text,text,text) to authenticated;
grant execute on function public.erp_x_inventory_counts(text,integer,integer) to authenticated;

commit;

begin;

create or replace function erp_private.apply_customer_priority_to_order()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_signal jsonb;
begin
  -- Historical/system imports do not have an authenticated actor and keep their explicit priority.
  if auth.uid() is null then
    return new;
  end if;

  select public.erp_x_customer_priority_signal(new.client_document)
  into v_signal;

  new.priority := coalesce(nullif(v_signal->>'orderPriority',''), 'MEDIUM');
  new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
    'prioritySource','CUSTOMER_INTELLIGENCE',
    'customerSegment',coalesce(v_signal->>'segment','NORMAL'),
    'customerPriorityScore',coalesce((v_signal->>'score')::numeric,0),
    'customerPriorityProvisional',coalesce((v_signal->>'provisional')::boolean,true),
    'customerPrioritySupportLevel',coalesce(v_signal->>'supportLevel','LOW'),
    'customerPriorityAlgorithmVersion',coalesce(v_signal->>'algorithmVersion','1.0.0')
  );

  return new;
end;
$$;

drop trigger if exists trg_orders_customer_priority on erp_supply.orders;
create trigger trg_orders_customer_priority
before insert on erp_supply.orders
for each row
execute function erp_private.apply_customer_priority_to_order();

revoke all on function erp_private.apply_customer_priority_to_order() from public,anon,authenticated;

commit;

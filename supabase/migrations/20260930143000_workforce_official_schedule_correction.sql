begin;

create or replace function erp_private.sync_workforce_official_schedule(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, erp_supply
as $$
begin
  delete from erp_supply.workforce_schedule_segments
  where organization_id=p_organization_id
    and iso_weekday between 1 and 5;

  insert into erp_supply.workforce_schedule_segments(
    organization_id,iso_weekday,start_time,end_time
  )
  select p_organization_id,d,'07:00'::time,'12:00'::time
  from generate_series(1,5) d
  union all
  select p_organization_id,d,'13:40'::time,'17:30'::time
  from generate_series(1,5) d;

  update erp_supply.workforce_schedule_segments
  set active=true
  where organization_id=p_organization_id
    and iso_weekday between 1 and 5;
end;
$$;

do $$
declare
  v_org uuid;
begin
  for v_org in select id from erp_supply.organizations loop
    perform erp_private.sync_workforce_official_schedule(v_org);
  end loop;
end;
$$;

commit;

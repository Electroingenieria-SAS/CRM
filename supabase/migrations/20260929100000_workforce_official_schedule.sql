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
  ) values
    (p_organization_id,1,'07:30'::time,'12:00'::time),
    (p_organization_id,1,'13:30'::time,'17:00'::time),
    (p_organization_id,2,'07:30'::time,'12:00'::time),
    (p_organization_id,2,'13:30'::time,'17:30'::time),
    (p_organization_id,3,'07:30'::time,'12:00'::time),
    (p_organization_id,3,'13:30'::time,'17:30'::time),
    (p_organization_id,4,'07:30'::time,'12:00'::time),
    (p_organization_id,4,'13:30'::time,'17:30'::time),
    (p_organization_id,5,'07:30'::time,'12:00'::time),
    (p_organization_id,5,'13:30'::time,'17:30'::time)
  on conflict(organization_id,iso_weekday,start_time,end_time)
  do update set active=true;
end;
$$;

revoke all on function erp_private.sync_workforce_official_schedule(uuid)
from public,anon,authenticated;

create or replace function erp_private.workforce_org_bootstrap_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, erp_private
as $$
begin
  perform erp_private.bootstrap_workforce_organization(new.id);
  perform erp_private.sync_workforce_official_schedule(new.id);
  return new;
end;
$$;

revoke all on function erp_private.workforce_org_bootstrap_trigger()
from public,anon,authenticated;

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

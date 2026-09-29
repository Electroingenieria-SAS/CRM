\set ON_ERROR_STOP on

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values('93000000-0000-4000-8000-000000000005','lider_logistica',false)
on conflict(profile_id,role_code) do nothing;

insert into erp_supply.workforce_profile_policies(
  organization_id,profile_id,exclude_from_occupancy_metrics,exclude_from_time_metrics,
  special_treatment_label,active,updated_by
)
select
  p.organization_id,
  '93000000-0000-4000-8000-000000000006',
  true,
  true,
  'Tratamiento especial QA',
  true,
  '93000000-0000-4000-8000-000000000005'
from erp_supply.profiles p
where p.id='93000000-0000-4000-8000-000000000006'
on conflict(profile_id) do update set
  exclude_from_occupancy_metrics=true,
  exclude_from_time_metrics=true,
  special_treatment_label='Tratamiento especial QA',
  active=true,
  updated_by='93000000-0000-4000-8000-000000000005',
  updated_at=now();

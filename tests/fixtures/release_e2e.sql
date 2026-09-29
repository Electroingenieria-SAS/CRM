\set ON_ERROR_STOP on

insert into erp_supply.audit_events(
  organization_id,actor_profile_id,actor_kind,module_code,action,
  resource_type,resource_id,result,request_id,metadata
)
select
  o.id,
  '93000000-0000-4000-8000-000000000004',
  'USER',
  'admin',
  'RELEASE_E2E_READY',
  'release',
  'hilo-12',
  'SUCCESS',
  'release-e2e-correlation',
  '{"fixture":"synthetic"}'::jsonb
from erp_supply.organizations o
where o.code='EI'
  and not exists(
    select 1 from erp_supply.audit_events a
    where a.organization_id=o.id
      and a.action='RELEASE_E2E_READY'
      and a.resource_id='hilo-12'
  );

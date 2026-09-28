\set ON_ERROR_STOP on

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000001',
  o.id,
  u.id,
  u.email,
  'QA Ventas',
  'QA-VENTAS'
from erp_supply.organizations o
join auth.users u on u.email='qa-seller@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000002',
  o.id,
  u.id,
  u.email,
  'QA Auditoría',
  'QA-AUDIT'
from erp_supply.organizations o
join auth.users u on u.email='qa-auditor@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000003',
  o.id,
  u.id,
  u.email,
  'QA Recuperación',
  'QA-RECOVERY'
from erp_supply.organizations o
join auth.users u on u.email='qa-recovery@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000004',
  o.id,
  u.id,
  u.email,
  'QA Superadmin',
  'QA-SUPERADMIN'
from erp_supply.organizations o
join auth.users u on u.email='qa-superadmin@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000005',
  o.id,u.id,u.email,'QA Coordinador A','QA-COORD-A'
from erp_supply.organizations o
join auth.users u on u.email='qa-coordinator-a@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-4000-8000-000000000006',
  o.id,u.id,u.email,'QA Coordinador B','QA-COORD-B'
from erp_supply.organizations o
join auth.users u on u.email='qa-coordinator-b@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select '93000000-0000-4000-8000-000000000007',o.id,u.id,u.email,'QA Cartera','QA-CARTERA'
from erp_supply.organizations o join auth.users u on u.email='qa-cartera@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select '93000000-0000-4000-8000-000000000008',o.id,u.id,u.email,'QA Caja A','QA-CAJA-A'
from erp_supply.organizations o join auth.users u on u.email='qa-caja-a@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select '93000000-0000-4000-8000-000000000009',o.id,u.id,u.email,'QA Caja B','QA-CAJA-B'
from erp_supply.organizations o join auth.users u on u.email='qa-caja-b@example.test'
where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select '93000000-0000-4000-8000-000000000010',o.id,u.id,u.email,'QA Gerencia','QA-GERENCIA'
from erp_supply.organizations o join auth.users u on u.email='qa-gerencia@example.test'
where o.code='EI';

do $e2e$
begin
  if (select count(*) from erp_supply.profiles where employee_code like 'QA-%') <> 10 then
    raise exception 'Synthetic Auth users were not linked to all CRM profiles';
  end if;
end
$e2e$;

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('93000000-0000-4000-8000-000000000001','ventas',true),
('93000000-0000-4000-8000-000000000002','auditoria',true),
('93000000-0000-4000-8000-000000000003','ventas',true),
('93000000-0000-4000-8000-000000000004','super_admin',true),
('93000000-0000-4000-8000-000000000005','coordinador_logistico',true),
('93000000-0000-4000-8000-000000000006','coordinador_logistico',true),
('93000000-0000-4000-8000-000000000007','cartera',true),
('93000000-0000-4000-8000-000000000008','caja',true),
('93000000-0000-4000-8000-000000000009','caja',true),
('93000000-0000-4000-8000-000000000010','gerencia',true);

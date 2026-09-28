\set ON_ERROR_STOP on

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
  confirmation_token,email_change,recovery_token,email_change_token_new
) values
(
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000001',
  'authenticated','authenticated','qa-seller@example.test',
  extensions.crypt(:'e2e_password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":"e2e"}'::jsonb,
  now(),now(),'','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000002',
  'authenticated','authenticated','qa-auditor@example.test',
  extensions.crypt(:'e2e_password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":"e2e"}'::jsonb,
  now(),now(),'','','',''
),
(
  '00000000-0000-0000-0000-000000000000',
  '91000000-0000-0000-0000-000000000003',
  'authenticated','authenticated','qa-recovery@example.test',
  extensions.crypt(:'e2e_password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"fixture":"e2e"}'::jsonb,
  now(),now(),'','','',''
);

insert into auth.identities(
  id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at
) values
(
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '{"sub":"91000000-0000-0000-0000-000000000001","email":"qa-seller@example.test"}'::jsonb,
  'email',now(),now(),now()
),
(
  '92000000-0000-0000-0000-000000000002',
  '91000000-0000-0000-0000-000000000002',
  '91000000-0000-0000-0000-000000000002',
  '{"sub":"91000000-0000-0000-0000-000000000002","email":"qa-auditor@example.test"}'::jsonb,
  'email',now(),now(),now()
),
(
  '92000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000003',
  '91000000-0000-0000-0000-000000000003',
  '{"sub":"91000000-0000-0000-0000-000000000003","email":"qa-recovery@example.test"}'::jsonb,
  'email',now(),now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-0000-0000-000000000001',
  o.id,
  '91000000-0000-0000-0000-000000000001',
  'qa-seller@example.test',
  'QA Ventas',
  'QA-VENTAS'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-0000-0000-000000000002',
  o.id,
  '91000000-0000-0000-0000-000000000002',
  'qa-auditor@example.test',
  'QA Auditoría',
  'QA-AUDIT'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
)
select
  '93000000-0000-0000-0000-000000000003',
  o.id,
  '91000000-0000-0000-0000-000000000003',
  'qa-recovery@example.test',
  'QA Recuperación',
  'QA-RECOVERY'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('93000000-0000-0000-0000-000000000001','ventas',true),
('93000000-0000-0000-0000-000000000002','auditoria',true),
('93000000-0000-0000-0000-000000000003','ventas',true);

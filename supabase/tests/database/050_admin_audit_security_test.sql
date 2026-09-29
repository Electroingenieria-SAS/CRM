begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
(
  '00000000-0000-0000-0000-000000000000',
  'ea100000-0000-4000-8000-000000000001',
  'authenticated','authenticated','admin-audit@example.test','',now(),
  '{}','{}',now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code,active,is_system
)
select
  'ea200000-0000-4000-8000-000000000001',o.id,
  'ea100000-0000-4000-8000-000000000001',
  'admin-audit@example.test','Admin Audit Test','ADM-AUDIT',true,false
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,email,display_name,employee_code,active,is_system
)
select
  'ea200000-0000-4000-8000-000000000002',o.id,
  'target-admin@example.test','Target Admin Test','TARGET',true,false
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values
('ea200000-0000-4000-8000-000000000001','super_admin',true),
('ea200000-0000-4000-8000-000000000002','ventas',true);

insert into erp_supply.organizations(id,code,name,timezone)
values(
  'ea300000-0000-4000-8000-000000000001',
  'AUDIT-OTHER','Audit Other Org','America/Bogota'
);

insert into erp_supply.audit_events(
  organization_id,actor_kind,module_code,action,resource_type,resource_id,result,metadata
) values (
  'ea300000-0000-4000-8000-000000000001',
  'SYSTEM','admin','OTHER_ORG_EVENT','profile','other','SUCCESS','{}'::jsonb
);

select set_config(
  'request.jwt.claims',
  '{"sub":"ea100000-0000-4000-8000-000000000001","role":"authenticated","email":"admin-audit@example.test","aal":"aal1"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.erp_x_admin_update_profile(
    'ea200000-0000-4000-8000-000000000002',
    'No debe cambiar',
    'NO'
  )$$,
  '42501',
  'MFA requerido para esta operación',
  'AAL1 cannot execute sensitive administration'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"ea100000-0000-4000-8000-000000000001","role":"authenticated","email":"admin-audit@example.test","aal":"aal2"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_admin_update_profile(
    'ea200000-0000-4000-8000-000000000002',
    'Target Updated',
    'TARGET-2'
  )$$,
  'AAL2 superadmin can update a profile'
);

select is(
  (select display_name from erp_supply.profiles where id='ea200000-0000-4000-8000-000000000002'),
  'Target Updated',
  'profile update persisted through guarded RPC'
);

select is(
  (
    select count(*)::integer
    from erp_supply.audit_events
    where resource_id='ea200000-0000-4000-8000-000000000002'
      and action='USER_PROFILE_UPDATED'
  ),
  1,
  'profile change is audited'
);

select lives_ok(
  $$select public.erp_x_admin_set_user_roles(
    'ea200000-0000-4000-8000-000000000002',
    array['ventas','auditoria'],
    'ventas',
    'Prueba pgTAP'
  )$$,
  'admin can assign existing real roles'
);

select is(
  (
    select count(*)::integer
    from erp_supply.profile_roles
    where profile_id='ea200000-0000-4000-8000-000000000002'
  ),
  2,
  'role assignment contains exactly the requested roles'
);

select throws_ok(
  $$select public.erp_x_admin_set_user_roles(
    'ea200000-0000-4000-8000-000000000001',
    array['ventas'],
    'ventas',
    'Intento de retirar último superadmin'
  )$$,
  '22023',
  'Debe permanecer al menos un superadministrador activo',
  'last active superadmin cannot be removed'
);

select is(
  (
    select count(*)::integer
    from erp_supply.audit_events
    where organization_id='ea300000-0000-4000-8000-000000000001'
  ),
  0,
  'audit RLS hides events from another organization'
);

select ok(
  jsonb_array_length(public.erp_x_audit_events(null,null,null,null,null,null,null,1,50)->'items')>=2,
  'audit explorer returns authorized organization events'
);

select is(
  (public.erp_x_admin_users(null,null,1,50)->'pagination'->>'page')::integer,
  1,
  'admin users read model is paginated'
);

select is(
  (public.erp_x_admin_roles()->'roles'->0 ? 'permissions'),
  true,
  'role catalog includes capability permissions'
);

reset role;

select throws_ok(
  $$update erp_supply.audit_events
    set action='TAMPERED'
    where organization_id=(
      select id from erp_supply.organizations where code='EI'
    )$$,
  '55000',
  'Audit events are append-only',
  'audit rows cannot be updated even by a privileged database role'
);

select throws_ok(
  $$insert into erp_supply.audit_events(
    organization_id,actor_kind,module_code,action,resource_type,result,metadata
  )
  select id,'SYSTEM','security','SECRET_TEST','test','FAILED','{"token":"do-not-store"}'::jsonb
  from erp_supply.organizations where code='EI'$$,
  '23514',
  null,
  'audit ledger rejects secret-shaped metadata'
);

select is(
  erp_private.audit_safe_metadata(
    '{"password":"x","token":"y","reason":"safe"}'::jsonb
  ),
  '{"reason":"safe"}'::jsonb,
  'audit sanitizer removes top-level credential fields'
);

select * from finish();
rollback;

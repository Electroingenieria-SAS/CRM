begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'eb100000-0000-4000-8000-000000000001',
  'authenticated','authenticated','paco-pgtap@example.test','',now(),
  '{}','{}',now(),now()
);

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code,active,is_system
)
select
  'eb200000-0000-4000-8000-000000000001',o.id,
  'eb100000-0000-4000-8000-000000000001',
  'paco-pgtap@example.test','PACO pgTAP','PACO-QA',true,false
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary)
values ('eb200000-0000-4000-8000-000000000001','super_admin',true);

insert into erp_supply.orders(
  id,organization_id,order_number,order_type_code,payment_condition_code,delivery_route_code,
  client_name,client_city,client_address,seller_profile_id,current_step_code,status,
  source,is_test,created_at,updated_at
)
select
  'eb300000-0000-4000-8000-000000000001',o.id,'PACO-DELAY-001',
  'PVC','CASH','LOCAL_DISPATCH','Cliente PACO','Cali','Calle PACO',
  'eb200000-0000-4000-8000-000000000001','ALISTAMIENTO','QUEUED',
  'QA_BOT',false,now()-interval '2 days',now()-interval '12 hours'
from erp_supply.organizations o where o.code='EI';

select set_config(
  'request.jwt.claims',
  '{"sub":"eb100000-0000-4000-8000-000000000001","role":"authenticated","email":"paco-pgtap@example.test","aal":"aal2"}',
  true
);
set local role authenticated;

select is(
  (
    select inactivity_threshold_minutes
    from erp_supply.assistant_role_alert_policies p
    join erp_supply.organizations o on o.id=p.organization_id
    where o.code='EI' and p.role_code='aux_logistica'
  ),
  20,
  'PACO inactivity threshold is role-configured at 20 minutes'
);

select is(
  (public.erp_x_assistant_rate_limit('message')->>'allowed')::boolean,
  true,
  'first PACO message is inside rate limit'
);

select lives_ok(
  $$select public.erp_x_assistant_alerts(true,20)$$,
  'PACO can refresh alerts from existing analytics read models'
);

select is(
  (
    select count(*)::integer
    from erp_supply.assistant_alerts
    where order_id='eb300000-0000-4000-8000-000000000001'
      and alert_type='ORDER_DELAY'
      and status='OPEN'
  ),
  1,
  'overdue synthetic order produces one deduplicated PACO alert'
);

select is(
  (
    select occurrence_count
    from erp_supply.assistant_alerts
    where order_id='eb300000-0000-4000-8000-000000000001'
      and alert_type='ORDER_DELAY'
  ),
  1,
  'first refresh records one occurrence'
);

select lives_ok(
  $$select public.erp_x_assistant_alerts(true,20)$$,
  'second refresh remains safe'
);

select is(
  (
    select count(*)::integer
    from erp_supply.assistant_alerts
    where order_id='eb300000-0000-4000-8000-000000000001'
      and alert_type='ORDER_DELAY'
  ),
  1,
  'repeated refresh does not duplicate the alert row'
);

select lives_ok(
  $$select public.erp_x_assistant_ack_alert(
    (
      select id from erp_supply.assistant_alerts
      where order_id='eb300000-0000-4000-8000-000000000001'
      limit 1
    )
  )$$,
  'authorized user can acknowledge visible PACO alert'
);

select is(
  (
    select count(*)::integer
    from erp_supply.audit_events
    where module_code='assistant' and action='ALERT_ACKNOWLEDGED'
  ),
  1,
  'PACO acknowledgement is written to immutable audit'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000001','authenticated','authenticated','freight-sales@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','41000000-0000-0000-0000-000000000002','authenticated','authenticated','freight-audit@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
)
select
  '42000000-0000-0000-0000-000000000001',o.id,
  '41000000-0000-0000-0000-000000000001','freight-sales@example.test','Freight Sales'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
)
select
  '42000000-0000-0000-0000-000000000002',o.id,
  '41000000-0000-0000-0000-000000000002','freight-audit@example.test','Freight Audit'
from erp_supply.organizations o where o.code='EI';

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('42000000-0000-0000-0000-000000000001','ventas',true),
('42000000-0000-0000-0000-000000000002','auditoria',true);

insert into erp_supply.freight_destinations(
  id,country_code,department_key,department_name,city_key,city_name,metadata
) values
('43000000-0000-0000-0000-000000000001','CO','QUINDIO','Quindío','FILANDIA QA','Filandia QA','{"synthetic":true}'),
('43000000-0000-0000-0000-000000000002','CO','AMAZONAS','Amazonas','LETICIA QA','Leticia QA','{"synthetic":true}');

select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated","email":"freight-sales@example.test"}',
  true
);
set local role authenticated;

select is(
  (public.erp_x_freight_catalog()#>>'{coverage,historicalSamples}')::bigint,
  749::bigint,
  'catalog reports the real historical sample size'
);

select lives_ok(
  $select public.erp_x_freight_history(
    null,'Quindío',null,'NATIONAL_DISPATCH',null,null,1,25
  )$,
  'sales may read normalized freight history through SECURITY INVOKER RPC'
);

select is(
  (
    select result->>'fallbackLevel'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        (select id from erp_supply.freight_destinations
         where city_key='ARMENIA' and department_key='QUINDIO' limit 1),
        'NATIONAL_DISPATCH',
        (select id from erp_supply.freight_carriers where code='COLVANES' limit 1)
      )->'results'
    ) result
    limit 1
  ),
  'CITY',
  'Armenia uses city evidence instead of false insufficient-history state'
);

select is(
  (
    select result->>'fallbackLevel'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '43000000-0000-0000-0000-000000000001',
        'NATIONAL_DISPATCH',
        (select id from erp_supply.freight_carriers where code='COLVANES' limit 1)
      )->'results'
    ) result
    limit 1
  ),
  'DEPARTMENT',
  'unseen city uses compatible department evidence'
);

select is(
  (
    select result->>'fallbackLevel'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '43000000-0000-0000-0000-000000000002',
        'NATIONAL_DISPATCH',
        (select id from erp_supply.freight_carriers where code='COLVANES' limit 1)
      )->'results'
    ) result
    limit 1
  ),
  'NATIONAL',
  'unseen city and department use national carrier evidence'
);

select is(
  (
    select result->>'status'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        (select id from erp_supply.freight_destinations
         where city_key='ARMENIA' and department_key='QUINDIO' limit 1),
        'LOCAL_DISPATCH',
        (select id from erp_supply.freight_carriers where code='COLVANES' limit 1)
      )->'results'
    ) result
    limit 1
  ),
  'INSUFFICIENT',
  'incompatible route does not reuse national-dispatch prices'
);

select is(
  (
    select result->>'status'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        (select id from erp_supply.freight_destinations
         where city_key='ARMENIA' and department_key='QUINDIO' limit 1),
        'CLIENT_PICKUP'
      )->'results'
    ) result
    limit 1
  ),
  'NOT_APPLICABLE',
  'client pickup never invents a freight cost'
);

select ok(
  (select count(*) from erp_supply.freight_predictions)>0,
  'prediction requests are versioned and persisted separately from actual cost'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"41000000-0000-0000-0000-000000000002","role":"authenticated","email":"freight-audit@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_freight_catalog()$$,
  'auditor may read freight intelligence'
);

select lives_ok(
  $select public.erp_x_freight_history(
    null,'Quindío',null,'NATIONAL_DISPATCH',null,null,1,25
  )$,
  'auditor may read normalized freight history'
);

select throws_ok(
  $select public.erp_x_freight_predict(
    (select id from erp_supply.freight_destinations
     where city_key='ARMENIA' and department_key='QUINDIO' limit 1),
    'NATIONAL_DISPATCH'
  )$$,
  '42501',
  'No autorizado para solicitar predicciones de flete',
  'auditor cannot create predictions'
);

select * from finish();
rollback;

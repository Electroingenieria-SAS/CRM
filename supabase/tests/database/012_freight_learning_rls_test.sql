begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','51000000-0000-0000-0000-000000000001','authenticated','authenticated','freight-admin-a@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-0000-0000-000000000002','authenticated','authenticated','freight-admin-b@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('52000000-0000-0000-0000-000000000001','FREIGHT_A','Freight Test A'),
('52000000-0000-0000-0000-000000000002','FREIGHT_B','Freight Test B');

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name
) values
('53000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','freight-admin-a@example.test','Freight Admin A'),
('53000000-0000-0000-0000-000000000002','52000000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002','freight-admin-b@example.test','Freight Admin B');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('53000000-0000-0000-0000-000000000001','super_admin',true),
('53000000-0000-0000-0000-000000000002','super_admin',true);

insert into erp_supply.freight_carriers(
  id,organization_id,code,name
) values
('54000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000001','QA_CARRIER','QA Carrier'),
('54000000-0000-0000-0000-000000000002','52000000-0000-0000-0000-000000000002','QA_CARRIER','QA Carrier');

insert into erp_supply.freight_destinations(
  id,country_code,department_key,department_name,city_key,city_name,metadata
) values
('55000000-0000-0000-0000-000000000001','CO','QA DEP','QA Departamento','OUTLIER CITY','Outlier City','{"synthetic":true}'),
('55000000-0000-0000-0000-000000000002','CO','QA DEP','QA Departamento','LINEAR CITY','Linear City','{"synthetic":true}');

insert into erp_supply.freight_observations(
  organization_id,carrier_id,destination_id,route_code,actual_cost,
  observed_at,source,created_by
) values
('52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','LOCAL_DISPATCH',10000,now()-interval '4 days','QA_SYNTHETIC','53000000-0000-0000-0000-000000000001'),
('52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','LOCAL_DISPATCH',11000,now()-interval '3 days','QA_SYNTHETIC','53000000-0000-0000-0000-000000000001'),
('52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','LOCAL_DISPATCH',12000,now()-interval '2 days','QA_SYNTHETIC','53000000-0000-0000-0000-000000000001'),
('52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','LOCAL_DISPATCH',13000,now()-interval '1 day','QA_SYNTHETIC','53000000-0000-0000-0000-000000000001'),
('52000000-0000-0000-0000-000000000001','54000000-0000-0000-0000-000000000001','55000000-0000-0000-0000-000000000001','LOCAL_DISPATCH',500000,now(),'QA_SYNTHETIC','53000000-0000-0000-0000-000000000001');

insert into erp_supply.freight_observations(
  organization_id,carrier_id,destination_id,route_code,actual_cost,weight_kg,
  observed_at,source,created_by
)
select
  '52000000-0000-0000-0000-000000000001',
  '54000000-0000-0000-0000-000000000001',
  '55000000-0000-0000-0000-000000000002',
  'LOCAL_DISPATCH',
  10000+(n*1000),
  n,
  now()-make_interval(days => 9-n),
  'QA_SYNTHETIC',
  '53000000-0000-0000-0000-000000000001'
from generate_series(1,8) n;

select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","email":"freight-admin-a@example.test"}',
  true
);
set local role authenticated;

select is(
  (
    select result->>'outlierCount'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '55000000-0000-0000-0000-000000000001',
        'LOCAL_DISPATCH',
        '54000000-0000-0000-0000-000000000001'
      )->'results'
    ) result
  ),
  '1',
  'IQR treatment excludes one extreme freight outlier'
);

select is(
  (
    select (result->>'estimateMid')::numeric
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '55000000-0000-0000-0000-000000000001',
        'LOCAL_DISPATCH',
        '54000000-0000-0000-0000-000000000001'
      )->'results'
    ) result
  ),
  11500::numeric,
  'robust center uses the cleaned median'
);

select is(
  (
    select result->>'basis'
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '55000000-0000-0000-0000-000000000002',
        'LOCAL_DISPATCH',
        '54000000-0000-0000-0000-000000000001',
        6
      )->'results'
    ) result
  ),
  'WEIGHT_REGRESSION',
  'weight regression activates only after enough paired evidence'
);

select is(
  (
    select (result->>'estimateMid')::numeric
    from jsonb_array_elements(
      public.erp_x_freight_predict(
        '55000000-0000-0000-0000-000000000002',
        'LOCAL_DISPATCH',
        '54000000-0000-0000-0000-000000000001',
        6
      )->'results'
    ) result
  ),
  16000::numeric,
  'progressive weight model produces reproducible estimate'
);

select lives_ok(
  $$select public.erp_x_record_freight_actual(
    '54000000-0000-0000-0000-000000000001',
    '55000000-0000-0000-0000-000000000002',
    'LOCAL_DISPATCH',
    16500,
    now(),
    null,
    (
      select id from erp_supply.freight_predictions
      where organization_id='52000000-0000-0000-0000-000000000001'
        and destination_id='55000000-0000-0000-0000-000000000002'
        and carrier_id='54000000-0000-0000-0000-000000000001'
        and estimate_mid is not null
      order by created_at desc
      limit 1
    ),
    6,
    null,
    null,
    'QA',
    null,
    'QA-REAL-001'
  )$$,
  'actual freight is appended without overwriting the estimate'
);

select is(
  (public.erp_x_freight_metrics()#>>'{summary,evaluatedPredictions}')::bigint,
  1::bigint,
  'prediction outcome is available for model evaluation'
);

select lives_ok(
  $$select public.erp_x_record_freight_actual(
    '54000000-0000-0000-0000-000000000001',
    '55000000-0000-0000-0000-000000000001',
    'LOCAL_DISPATCH',
    14000,
    now(),
    null,null,null,null,null,null,null,null
  )$$,
  'multiple observations without external keys are allowed'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-0000-0000-000000000002","role":"authenticated","email":"freight-admin-b@example.test"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from erp_supply.freight_observations),
  0::bigint,
  'organization B cannot read organization A freight observations'
);

select throws_ok(
  $$select public.erp_x_record_freight_actual(
    '54000000-0000-0000-0000-000000000002',
    '55000000-0000-0000-0000-000000000001',
    'LOCAL_DISPATCH',
    -1,
    now()
  )$$,
  'P0001',
  'El costo real debe ser un valor no negativo',
  'negative actual freight cost is rejected'
);

select * from finish();
rollback;

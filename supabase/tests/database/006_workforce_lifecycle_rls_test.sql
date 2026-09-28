begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users(
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('00000000-0000-0000-0000-000000000000','72000000-0000-4000-8000-000000000001','authenticated','authenticated','wf-leader@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','72000000-0000-4000-8000-000000000002','authenticated','authenticated','wf-worker@example.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','72000000-0000-4000-8000-000000000003','authenticated','authenticated','wf-other@example.test','',now(),'{}','{}',now(),now());

insert into erp_supply.organizations(id,code,name) values
('73000000-0000-4000-8000-000000000001','WF_A','Workforce A'),
('73000000-0000-4000-8000-000000000002','WF_B','Workforce B');

insert into erp_supply.profiles(
  id,organization_id,auth_user_id,email,display_name,employee_code
) values
('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','wf-leader@example.test','Workforce Leader','WF-L'),
('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','wf-worker@example.test','Workforce Worker','WF-W'),
('74000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000003','wf-other@example.test','Other Organization','WF-O');

insert into erp_supply.profile_roles(profile_id,role_code,is_primary) values
('74000000-0000-4000-8000-000000000001','lider_logistica',true),
('74000000-0000-4000-8000-000000000002','aux_logistica',true),
('74000000-0000-4000-8000-000000000003','aux_logistica',true);

select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","email":"wf-leader@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_workforce_create_activity(
    jsonb_build_object(
      'catalogId',(select id from erp_supply.workforce_activity_catalog where code='LOG_LOADING' limit 1),
      'assigneeProfileId','74000000-0000-4000-8000-000000000002',
      'plannedStart','2026-09-29T07:00:00-05:00',
      'plannedEnd','2026-09-29T09:00:00-05:00',
      'description','Actividad sintética'
    ),
    'wf-create-1'
  )$$,
  'leader plans an activity for a compatible worker'
);

select is(
  (public.erp_x_workforce_create_activity(
    jsonb_build_object(
      'catalogId',(select id from erp_supply.workforce_activity_catalog where code='LOG_LOADING' limit 1),
      'assigneeProfileId','74000000-0000-4000-8000-000000000002',
      'plannedStart','2026-09-29T07:00:00-05:00',
      'plannedEnd','2026-09-29T09:00:00-05:00'
    ),
    'wf-create-1'
  )->>'idempotent')::boolean,
  true,
  'create is idempotent'
);

select throws_ok(
  $$select public.erp_x_workforce_create_activity(
    jsonb_build_object(
      'catalogId',(select id from erp_supply.workforce_activity_catalog where code='LOG_LOADING' limit 1),
      'assigneeProfileId','74000000-0000-4000-8000-000000000002',
      'plannedStart','2026-09-29T08:00:00-05:00',
      'plannedEnd','2026-09-29T10:00:00-05:00'
    ),
    'wf-overlap'
  )$$,
  '23P01',
  'La persona ya tiene una actividad incompatible en ese horario',
  'overlapping activities are rejected'
);

select throws_ok(
  $$select public.erp_x_workforce_create_activity(
    jsonb_build_object(
      'catalogId',(select id from erp_supply.workforce_activity_catalog where code='LOG_LOADING' limit 1),
      'assigneeProfileId','74000000-0000-4000-8000-000000000002',
      'plannedStart','2026-09-29T12:00:00-05:00',
      'plannedEnd','2026-09-29T13:40:00-05:00'
    ),
    'wf-lunch'
  )$$,
  '22023',
  'La actividad debe quedar completamente dentro de la jornada laboral',
  'lunch-break planning is rejected'
);

select throws_ok(
  $$select public.erp_x_workforce_assign_activity(
    (select id from erp_supply.workforce_activities where organization_id='73000000-0000-4000-8000-000000000001' limit 1),
    '74000000-0000-4000-8000-000000000002',
    99,
    'wf-stale'
  )$$,
  '40001',
  'La actividad cambió; actualiza la vista antes de continuar',
  'stale optimistic version is rejected'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","email":"wf-worker@example.test"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(
    public.erp_x_workforce_schedule(date '2026-09-29',date '2026-09-29',null)->'activities'
  ),
  1,
  'assignee sees activity regardless of creator'
);

select lives_ok(
  $$select public.erp_x_workforce_start_activity(
    (select id from erp_supply.workforce_activities limit 1),1,'wf-start-1'
  )$$,
  'responsible starts own activity'
);

select is(
  (public.erp_x_workforce_start_activity(
    (select id from erp_supply.workforce_activities limit 1),1,'wf-start-1'
  )->>'idempotent')::boolean,
  true,
  'start retry is idempotent'
);

select throws_ok(
  $$select public.erp_x_workforce_start_activity(
    (select id from erp_supply.workforce_activities limit 1),2,'wf-start-second'
  )$$,
  '22023',
  'Solo una actividad planificada puede iniciarse',
  'double start with a new key is rejected'
);

select throws_ok(
  $$select public.erp_x_workforce_complete_activity(
    (select id from erp_supply.workforce_activities limit 1),'Sin foto',2,'wf-complete-missing'
  )$$,
  '23514',
  'Falta la evidencia requerida para finalizar la actividad',
  'backend blocks normal closure without required photo'
);

select lives_ok(
  $$select public.erp_x_workforce_add_evidence(
    (select id from erp_supply.workforce_activities limit 1),
    '{"evidenceType":"FINAL_PHOTO","storageProvider":"TEST","storageReference":"org/activity/photo.png","fileName":"photo.png","mimeType":"image/png","sizeBytes":4}'::jsonb,
    'wf-evidence-1'
  )$$,
  'responsible records final photo evidence'
);

select lives_ok(
  $$select public.erp_x_workforce_complete_activity(
    (select id from erp_supply.workforce_activities limit 1),'Finalizada',2,'wf-complete-1'
  )$$,
  'responsible closes activity without manager approval'
);

select is(
  (public.erp_x_workforce_complete_activity(
    (select id from erp_supply.workforce_activities limit 1),'Finalizada',2,'wf-complete-1'
  )->>'idempotent')::boolean,
  true,
  'completion retry is idempotent'
);

select throws_ok(
  $$select public.erp_x_workforce_complete_activity(
    (select id from erp_supply.workforce_activities limit 1),'Otra vez',3,'wf-complete-second'
  )$$,
  '22023',
  'Solo una actividad en curso puede finalizarse',
  'double close with a new key is rejected'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","email":"wf-leader@example.test"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.erp_x_workforce_set_profile_policy(
    '74000000-0000-4000-8000-000000000002',true,true,'Tratamiento especial QA'
  )$$,
  'manager configures special treatment by profile id'
);

select ok(
  exists(
    select 1
    from jsonb_array_elements(
      public.erp_x_workforce_schedule(date '2026-09-29',date '2026-09-29',null)->'people'
    ) p
    where p->>'id'='74000000-0000-4000-8000-000000000002'
      and (p->>'specialTreatment')::boolean
  ),
  'special-treatment person remains visible in schedule'
);

select is(
  jsonb_array_length(
    public.erp_x_workforce_indicators(date '2026-09-29',date '2026-09-29')->'people'
  ),
  1,
  'special-treatment worker is excluded from time and occupancy indicators'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated","email":"wf-other@example.test"}',
  true
);
set local role authenticated;

select is(
  jsonb_array_length(
    public.erp_x_workforce_schedule(date '2026-09-29',date '2026-09-29',null)->'activities'
  ),
  0,
  'other organization cannot read workforce activities'
);

select ok(
  erp_private.workforce_occupancy_status(
    '74000000-0000-4000-8000-000000000003',
    '2026-09-29T12:30:00-05:00'::timestamptz
  )='OUT_OF_SCHEDULE',
  'lunch interval reports out of schedule'
);

select * from finish();
rollback;

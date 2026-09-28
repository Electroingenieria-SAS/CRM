begin;

create or replace function public.erp_x_workforce_add_evidence(
  p_activity_id uuid,
  p_evidence jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_activity erp_supply.workforce_activities%rowtype;
  v_type text:=upper(nullif(trim(p_evidence->>'evidenceType'),''));
  v_mime text:=nullif(trim(p_evidence->>'mimeType'),'');
  v_evidence_id uuid;
  v_event jsonb;
begin
  perform erp_private.workforce_lock_idempotency(v_org,p_idempotency_key);

  select ev.payload into v_event
  from erp_supply.workforce_activity_events ev
  where ev.organization_id=v_org and ev.idempotency_key=trim(p_idempotency_key)
  limit 1;

  if v_event is not null then
    return v_event || jsonb_build_object('success',true,'idempotent',true,'contractVersion','1.0.0');
  end if;

  select * into v_activity
  from erp_supply.workforce_activities a
  where a.id=p_activity_id and a.organization_id=v_org
  for update;

  if not found then raise exception 'Actividad no encontrada' using errcode='P0002'; end if;
  if not erp_private.workforce_can_manage_profile(v_activity.assignee_profile_id) then
    raise exception 'No autorizado para adjuntar evidencia' using errcode='42501';
  end if;
  if v_activity.status in('COMPLETED','CANCELLED') then
    raise exception 'No se puede adjuntar evidencia a una actividad finalizada' using errcode='22023';
  end if;
  if v_type not in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO','FILE','LINK','ERP_REFERENCE') then
    raise exception 'Tipo de evidencia inválido' using errcode='22023';
  end if;
  if nullif(trim(p_evidence->>'storageReference'),'') is null then
    raise exception 'La referencia de almacenamiento es obligatoria' using errcode='22023';
  end if;
  if v_type in('BEFORE_PHOTO','AFTER_PHOTO','FINAL_PHOTO')
     and coalesce(v_mime,'') not like 'image/%' then
    raise exception 'La evidencia fotográfica debe ser una imagen' using errcode='23514';
  end if;
  if v_type in('AFTER_PHOTO','FINAL_PHOTO') and v_activity.status<>'IN_PROGRESS' then
    raise exception 'La evidencia final se adjunta durante la ejecución' using errcode='22023';
  end if;

  insert into erp_supply.workforce_activity_evidence(
    organization_id,activity_id,evidence_type,storage_provider,storage_reference,
    file_name,mime_type,size_bytes,captured_at,uploaded_by,metadata
  ) values(
    v_org,p_activity_id,v_type,
    coalesce(nullif(trim(p_evidence->>'storageProvider'),''),'EXTERNAL'),
    trim(p_evidence->>'storageReference'),
    nullif(trim(p_evidence->>'fileName'),''),
    v_mime,
    nullif(p_evidence->>'sizeBytes','')::bigint,
    nullif(p_evidence->>'capturedAt','')::timestamptz,
    v_actor,
    case when jsonb_typeof(coalesce(p_evidence->'metadata','{}'::jsonb))='object'
      then coalesce(p_evidence->'metadata','{}'::jsonb)
      else '{}'::jsonb end
  ) returning id into v_evidence_id;

  v_event:=jsonb_build_object(
    'activityId',p_activity_id,
    'evidenceId',v_evidence_id,
    'evidenceType',v_type
  );

  insert into erp_supply.workforce_activity_events(
    organization_id,activity_id,actor_profile_id,event_type,from_status,to_status,
    idempotency_key,payload
  ) values(
    v_org,p_activity_id,v_actor,'EVIDENCE_ADDED',v_activity.status,v_activity.status,
    trim(p_idempotency_key),v_event
  );

  return v_event || jsonb_build_object(
    'success',true,'idempotent',false,'contractVersion','1.0.0'
  );
exception
  when invalid_text_representation then
    raise exception 'Metadata de evidencia inválida' using errcode='22023';
end;
$$;

create or replace function public.erp_x_workforce_set_profile_policy(
  p_profile_id uuid,
  p_exclude_occupancy boolean,
  p_exclude_time boolean,
  p_label text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
begin
  if not erp_private.workforce_can_manage() then
    raise exception 'No autorizado para configurar políticas Workforce' using errcode='42501';
  end if;

  if not exists(
    select 1 from erp_supply.profiles p
    where p.id=p_profile_id and p.organization_id=v_org and p.active
  ) then
    raise exception 'Perfil no encontrado' using errcode='P0002';
  end if;

  insert into erp_supply.workforce_profile_policies(
    organization_id,profile_id,exclude_from_occupancy_metrics,exclude_from_time_metrics,
    special_treatment_label,active,updated_by,updated_at
  ) values(
    v_org,p_profile_id,coalesce(p_exclude_occupancy,false),coalesce(p_exclude_time,false),
    nullif(trim(p_label),''),true,v_actor,now()
  )
  on conflict(profile_id) do update set
    exclude_from_occupancy_metrics=excluded.exclude_from_occupancy_metrics,
    exclude_from_time_metrics=excluded.exclude_from_time_metrics,
    special_treatment_label=excluded.special_treatment_label,
    active=true,
    updated_by=excluded.updated_by,
    updated_at=now();

  return jsonb_build_object(
    'success',true,'profileId',p_profile_id,
    'excludeFromOccupancyMetrics',coalesce(p_exclude_occupancy,false),
    'excludeFromTimeMetrics',coalesce(p_exclude_time,false),
    'specialTreatmentLabel',nullif(trim(p_label),''),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_workforce_indicators(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not erp_private.can_access_module('workforce','read') then
    raise exception 'No autorizado para consultar indicadores Workforce' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then
    raise exception 'Rango de indicadores inválido; máximo 32 días' using errcode='22023';
  end if;

  select coalesce(o.timezone,'America/Bogota') into v_tz
  from erp_supply.organizations o where o.id=v_org;
  v_start:=p_from::timestamp at time zone v_tz;
  v_end:=(p_to+1)::timestamp at time zone v_tz;

  return jsonb_build_object(
    'summary',(
      select jsonb_build_object(
        'planned',count(*) filter(where a.status='PLANNED'),
        'inProgress',count(*) filter(where a.status='IN_PROGRESS'),
        'blocked',count(*) filter(where a.status='BLOCKED'),
        'completed',count(*) filter(where a.status='COMPLETED'),
        'cancelled',count(*) filter(where a.status='CANCELLED'),
        'over60Minutes',count(*) filter(
          where a.status<>'CANCELLED'
            and erp_private.workforce_time_signal(a.id)='OVER_60_MINUTES'
        )
      )
      from erp_supply.workforce_activities a
      left join erp_supply.workforce_profile_policies wp on wp.profile_id=a.assignee_profile_id
      where a.organization_id=v_org
        and a.planned_start<v_end
        and a.planned_end>v_start
        and not coalesce(wp.active and wp.exclude_from_occupancy_metrics,false)
    ),
    'people',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId',p.id,
        'name',p.display_name,
        'occupancy',erp_private.workforce_occupancy_status(p.id,now()),
        'completed',coalesce(m.completed,0),
        'activeBusinessMinutes',coalesce(m.active_seconds,0)/60,
        'over60Minutes',coalesce(m.over_sixty,0)
      ) order by p.display_name),'[]'::jsonb)
      from erp_supply.profiles p
      left join erp_supply.workforce_profile_policies wp on wp.profile_id=p.id
      left join lateral(
        select
          count(*) filter(where a.status='COMPLETED') completed,
          coalesce(sum(
            case
              when a.actual_start is null then 0
              else erp_private.workforce_business_seconds(
                a.organization_id,
                greatest(a.actual_start,v_start),
                least(coalesce(a.actual_end,now()),v_end)
              )
            end
          ),0) active_seconds,
          count(*) filter(
            where a.status<>'CANCELLED'
              and erp_private.workforce_time_signal(a.id)='OVER_60_MINUTES'
          ) over_sixty
        from erp_supply.workforce_activities a
        where a.assignee_profile_id=p.id
          and a.organization_id=v_org
          and a.planned_start<v_end
          and a.planned_end>v_start
      ) m on true
      where p.organization_id=v_org
        and p.active and not p.is_system
        and not coalesce(wp.active and wp.exclude_from_occupancy_metrics,false)
        and not coalesce(wp.active and wp.exclude_from_time_metrics,false)
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_workforce_add_evidence(uuid,jsonb,text) from public,anon;
revoke all on function public.erp_x_workforce_set_profile_policy(uuid,boolean,boolean,text) from public,anon;
revoke all on function public.erp_x_workforce_indicators(date,date) from public,anon;

grant execute on function public.erp_x_workforce_add_evidence(uuid,jsonb,text) to authenticated;
grant execute on function public.erp_x_workforce_set_profile_policy(uuid,boolean,boolean,text) to authenticated;
grant execute on function public.erp_x_workforce_indicators(date,date) to authenticated;

commit;

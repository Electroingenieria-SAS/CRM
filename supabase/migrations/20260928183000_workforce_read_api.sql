begin;

create or replace function public.erp_x_workforce_catalog()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id,
      'code',c.code,
      'name',c.name,
      'description',c.description,
      'categoryCode',c.category_code,
      'categoryLabel',c.category_label,
      'subcategory',c.subcategory,
      'activityGroup',c.activity_group,
      'activityKind',c.activity_kind,
      'standardMinutes',c.standard_minutes,
      'evidencePolicy',c.evidence_policy,
      'teamAllowed',c.team_allowed,
      'allowedRoles',c.allowed_roles,
      'sortOrder',c.sort_order
    ) order by c.category_label,c.subcategory,c.sort_order,c.name),'[]'::jsonb),
    'contractVersion','1.0.0'
  )
  from erp_supply.workforce_activity_catalog c
  where c.organization_id=erp_private.current_org_id()
    and c.active
    and erp_private.can_access_module('workforce','read')
$$;

create or replace function public.erp_x_workforce_schedule(
  p_from date,
  p_to date,
  p_profile_id uuid default null
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
    raise exception 'No autorizado para consultar Workforce' using errcode='42501';
  end if;

  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then
    raise exception 'Rango de cronograma inválido; máximo 63 días' using errcode='22023';
  end if;

  select coalesce(o.timezone,'America/Bogota') into v_tz
  from erp_supply.organizations o where o.id=v_org;

  v_start:=(p_from::timestamp at time zone v_tz);
  v_end:=((p_to+1)::timestamp at time zone v_tz);

  return jsonb_build_object(
    'range',jsonb_build_object('from',p_from,'to',p_to,'timezone',v_tz),
    'people',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,
        'name',p.display_name,
        'employeeCode',p.employee_code,
        'roles',coalesce((
          select jsonb_agg(pr.role_code order by pr.role_code)
          from erp_supply.profile_roles pr where pr.profile_id=p.id
        ),'[]'::jsonb),
        'occupancy',erp_private.workforce_occupancy_status(p.id,now()),
        'specialTreatment',coalesce(wp.active and (
          wp.exclude_from_occupancy_metrics or wp.exclude_from_time_metrics
        ),false),
        'specialTreatmentLabel',case when wp.active then wp.special_treatment_label else null end,
        'excludeFromOccupancyMetrics',coalesce(wp.active and wp.exclude_from_occupancy_metrics,false),
        'excludeFromTimeMetrics',coalesce(wp.active and wp.exclude_from_time_metrics,false)
      ) order by p.display_name),'[]'::jsonb)
      from erp_supply.profiles p
      left join erp_supply.workforce_profile_policies wp on wp.profile_id=p.id
      where p.organization_id=v_org
        and p.active
        and not p.is_system
        and (p_profile_id is null or p.id=p_profile_id)
    ),
    'activities',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,
        'assigneeProfileId',a.assignee_profile_id,
        'assigneeName',p.display_name,
        'catalogId',a.catalog_id,
        'catalogCode',c.code,
        'title',a.title,
        'description',a.description,
        'categoryCode',c.category_code,
        'categoryLabel',c.category_label,
        'subcategory',c.subcategory,
        'activityKind',c.activity_kind,
        'evidencePolicy',c.evidence_policy,
        'status',a.status,
        'source',a.source,
        'plannedStart',a.planned_start,
        'plannedEnd',a.planned_end,
        'actualStart',a.actual_start,
        'actualEnd',a.actual_end,
        'orderId',a.order_id,
        'orderTaskId',a.order_task_id,
        'orderNumber',o.order_number,
        'blockReason',a.block_reason,
        'timeSignal',erp_private.workforce_time_signal(a.id),
        'businessSeconds',case
          when a.actual_start is null then 0
          else erp_private.workforce_business_seconds(
            a.organization_id,
            a.actual_start,
            coalesce(a.actual_end,now())
          )
        end,
        'evidenceCount',(select count(*) from erp_supply.workforce_activity_evidence e where e.activity_id=a.id),
        'version',a.version
      ) order by a.planned_start,a.created_at),'[]'::jsonb)
      from erp_supply.workforce_activities a
      join erp_supply.workforce_activity_catalog c on c.id=a.catalog_id
      join erp_supply.profiles p on p.id=a.assignee_profile_id
      left join erp_supply.orders o on o.id=a.order_id
      where a.organization_id=v_org
        and a.planned_start<v_end
        and a.planned_end>v_start
        and (p_profile_id is null or a.assignee_profile_id=p_profile_id)
    ),
    'calendar',jsonb_build_object(
      'segments',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'weekday',s.iso_weekday,
          'startTime',to_char(s.start_time,'HH24:MI'),
          'endTime',to_char(s.end_time,'HH24:MI')
        ) order by s.iso_weekday,s.start_time),'[]'::jsonb)
        from erp_supply.workforce_schedule_segments s
        where s.organization_id=v_org and s.active
      ),
      'holidays',(
        select coalesce(jsonb_agg(jsonb_build_object(
          'date',h.holiday_date,
          'name',h.name,
          'sourceKind',h.source_kind
        ) order by h.holiday_date),'[]'::jsonb)
        from erp_supply.workforce_holidays h
        where h.organization_id=v_org
          and h.holiday_date between p_from and p_to
      )
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_workforce_activity_detail(p_activity_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
begin
  if not erp_private.can_access_module('workforce','read') then
    raise exception 'No autorizado para consultar Workforce' using errcode='42501';
  end if;

  if not exists(
    select 1 from erp_supply.workforce_activities a
    where a.id=p_activity_id and a.organization_id=v_org
  ) then
    raise exception 'Actividad no encontrada' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'activity',(
      select jsonb_build_object(
        'id',a.id,
        'assigneeProfileId',a.assignee_profile_id,
        'assigneeName',p.display_name,
        'catalogId',a.catalog_id,
        'catalogCode',c.code,
        'catalogName',c.name,
        'title',a.title,
        'description',a.description,
        'categoryCode',c.category_code,
        'categoryLabel',c.category_label,
        'subcategory',c.subcategory,
        'activityKind',c.activity_kind,
        'standardMinutes',c.standard_minutes,
        'evidencePolicy',c.evidence_policy,
        'status',a.status,
        'source',a.source,
        'plannedStart',a.planned_start,
        'plannedEnd',a.planned_end,
        'actualStart',a.actual_start,
        'actualEnd',a.actual_end,
        'orderId',a.order_id,
        'orderTaskId',a.order_task_id,
        'orderNumber',o.order_number,
        'blockReason',a.block_reason,
        'resultNote',a.result_note,
        'timeSignal',erp_private.workforce_time_signal(a.id),
        'evidenceComplete',erp_private.workforce_evidence_complete(a.id),
        'version',a.version
      )
      from erp_supply.workforce_activities a
      join erp_supply.workforce_activity_catalog c on c.id=a.catalog_id
      join erp_supply.profiles p on p.id=a.assignee_profile_id
      left join erp_supply.orders o on o.id=a.order_id
      where a.id=p_activity_id and a.organization_id=v_org
    ),
    'evidence',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,
        'evidenceType',e.evidence_type,
        'storageProvider',e.storage_provider,
        'storageReference',e.storage_reference,
        'fileName',e.file_name,
        'mimeType',e.mime_type,
        'sizeBytes',e.size_bytes,
        'capturedAt',e.captured_at,
        'createdAt',e.created_at
      ) order by e.created_at),'[]'::jsonb)
      from erp_supply.workforce_activity_evidence e
      where e.activity_id=p_activity_id
    ),
    'events',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',ev.id,
        'eventType',ev.event_type,
        'fromStatus',ev.from_status,
        'toStatus',ev.to_status,
        'actorProfileId',ev.actor_profile_id,
        'payload',ev.payload,
        'createdAt',ev.created_at
      ) order by ev.created_at),'[]'::jsonb)
      from erp_supply.workforce_activity_events ev
      where ev.activity_id=p_activity_id
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_workforce_catalog() from public,anon;
revoke all on function public.erp_x_workforce_schedule(date,date,uuid) from public,anon;
revoke all on function public.erp_x_workforce_activity_detail(uuid) from public,anon;

grant execute on function public.erp_x_workforce_catalog() to authenticated;
grant execute on function public.erp_x_workforce_schedule(date,date,uuid) to authenticated;
grant execute on function public.erp_x_workforce_activity_detail(uuid) to authenticated;

commit;

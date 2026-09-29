begin;

create or replace function public.erp_x_order_workforce_indicators(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_tz text;
  v_from date;
  v_to date;
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz:=now();
  v_result jsonb;
begin
  if not erp_private.can_access_module('workforce','read')
     or not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar indicadores operativos' using errcode='42501';
  end if;

  select coalesce(o.timezone,'America/Bogota') into v_tz
  from erp_supply.organizations o
  where o.id=v_org;

  v_from:=coalesce(p_from,(v_now at time zone v_tz)::date);
  v_to:=coalesce(p_to,v_from);

  if v_to<v_from or v_to-v_from>31 then
    raise exception 'Rango de indicadores inválido; máximo 32 días' using errcode='22023';
  end if;

  v_start:=v_from::timestamp at time zone v_tz;
  v_end:=(v_to+1)::timestamp at time zone v_tz;

  with blocked_intervals as(
    select
      e.activity_id,
      greatest(e.created_at,v_start) blocked_start,
      least(
        coalesce((
          select min(n.created_at)
          from erp_supply.workforce_activity_events n
          where n.activity_id=e.activity_id
            and n.created_at>e.created_at
            and n.event_type in('ACTIVITY_RESUMED','ACTIVITY_COMPLETED','ACTIVITY_CANCELLED')
        ),v_now),
        v_end
      ) blocked_end
    from erp_supply.workforce_activity_events e
    join erp_supply.workforce_activities a on a.id=e.activity_id
    where e.organization_id=v_org
      and e.event_type='ACTIVITY_BLOCKED'
      and e.created_at<v_end
      and coalesce(a.actual_end,v_now)>v_start
  ),
  blocked as(
    select
      b.activity_id,
      coalesce(sum(
        case when b.blocked_end>b.blocked_start
          then erp_private.workforce_business_seconds(
            v_org,b.blocked_start,b.blocked_end
          )
          else 0
        end
      ),0)::bigint blocked_seconds
    from blocked_intervals b
    group by b.activity_id
  ),
  activity_stats as(
    select
      a.id,
      a.assignee_profile_id,
      a.order_id,
      a.order_task_id,
      t.step_code,
      a.status,
      a.actual_start,
      a.actual_end,
      a.planned_start,
      a.planned_end,
      coalesce(b.blocked_seconds,0) blocked_seconds,
      case
        when a.actual_start is null then 0
        else greatest(
          erp_private.workforce_business_seconds(
            v_org,
            greatest(a.actual_start,v_start),
            least(coalesce(a.actual_end,v_now),v_end)
          )-coalesce(b.blocked_seconds,0),
          0
        )
      end::bigint productive_seconds
    from erp_supply.workforce_activities a
    left join erp_supply.order_tasks t on t.id=a.order_task_id
    left join blocked b on b.activity_id=a.id
    where a.organization_id=v_org
      and a.planned_start<v_end
      and a.planned_end>v_start
  ),
  people_rows as(
    select
      p.id profile_id,
      p.display_name name,
      erp_private.workforce_occupancy_status(p.id,v_now) occupancy,
      ca.order_id current_order_id,
      co.order_number current_order_number,
      ca.title current_activity_title,
      coalesce(pm.productive_seconds,0)::bigint productive_seconds,
      coalesce(pm.blocked_seconds,0)::bigint blocked_seconds,
      coalesce(pm.completed,0)::integer completed,
      case
        when erp_private.workforce_occupancy_status(p.id,v_now) in('OCCUPIED','BLOCKED') then 0
        when erp_private.workforce_occupancy_status(p.id,v_now)='OUT_OF_SCHEDULE' then null
        when le.last_end is null then null
        else erp_private.workforce_business_seconds(v_org,le.last_end,v_now)/60
      end inactivity_minutes,
      coalesce(wp.exclude_from_occupancy_metrics,false) excluded_occupancy,
      coalesce(wp.exclude_from_time_metrics,false) excluded_time
    from erp_supply.profiles p
    left join erp_supply.workforce_profile_policies wp
      on wp.profile_id=p.id and wp.active
    left join lateral(
      select a.order_id,a.title
      from erp_supply.workforce_activities a
      where a.organization_id=v_org
        and a.assignee_profile_id=p.id
        and a.status in('PLANNED','IN_PROGRESS','BLOCKED')
        and (
          a.status in('IN_PROGRESS','BLOCKED')
          or (a.planned_start<=v_now and a.planned_end>v_now)
        )
      order by case a.status when 'BLOCKED' then 0 when 'IN_PROGRESS' then 1 else 2 end,
               a.updated_at desc
      limit 1
    ) ca on true
    left join erp_supply.orders co on co.id=ca.order_id
    left join lateral(
      select
        sum(s.productive_seconds)::bigint productive_seconds,
        sum(s.blocked_seconds)::bigint blocked_seconds,
        count(*) filter(where s.status='COMPLETED')::integer completed
      from activity_stats s
      where s.assignee_profile_id=p.id
    ) pm on true
    left join lateral(
      select max(a.actual_end) last_end
      from erp_supply.workforce_activities a
      where a.organization_id=v_org
        and a.assignee_profile_id=p.id
        and a.actual_end is not null
        and a.actual_end<=v_now
    ) le on true
    where p.organization_id=v_org
      and p.active
      and not p.is_system
  ),
  operational_orders as(
    select
      o.id order_id,
      o.order_number,
      o.current_step_code step_code,
      o.seller_profile_id,
      seller.display_name seller_name,
      t.id task_id,
      t.assigned_profile_id responsible_profile_id,
      responsible.display_name responsible_name,
      x.workforce_activity_id,
      wa.status workforce_status,
      coalesce((
        select sum(s.productive_seconds)
        from activity_stats s
        where s.order_id=o.id
      ),0)::bigint productive_seconds
    from erp_supply.orders o
    join erp_supply.order_workforce_step_mappings m
      on m.step_code=o.current_step_code and m.active
    join erp_supply.profiles seller on seller.id=o.seller_profile_id
    left join lateral(
      select ot.*
      from erp_supply.order_tasks ot
      where ot.order_id=o.id
        and ot.step_code=o.current_step_code
        and ot.status in('QUEUED','ASSIGNED','IN_PROGRESS','BLOCKED')
      order by ot.sequence_no desc,ot.created_at desc
      limit 1
    ) t on true
    left join erp_supply.profiles responsible on responsible.id=t.assigned_profile_id
    left join lateral(
      select ow.workforce_activity_id
      from erp_supply.order_workforce_outbox ow
      where ow.organization_id=v_org
        and ow.order_id=o.id
        and (t.id is null or ow.order_task_id=t.id)
        and ow.status='PROCESSED'
        and ow.workforce_activity_id is not null
      order by ow.processed_at desc nulls last,ow.created_at desc
      limit 1
    ) x on true
    left join erp_supply.workforce_activities wa on wa.id=x.workforce_activity_id
    where o.organization_id=v_org
  ),
  averages_by_step as(
    select
      s.step_code,
      round(avg(s.productive_seconds/60.0),2) average_minutes
    from activity_stats s
    left join erp_supply.workforce_profile_policies wp
      on wp.profile_id=s.assignee_profile_id and wp.active
    where s.status='COMPLETED'
      and s.step_code is not null
      and not coalesce(wp.exclude_from_time_metrics,false)
    group by s.step_code
  ),
  order_counts_by_step as(
    select step_code,count(*)::integer total
    from operational_orders
    group by step_code
  )
  select jsonb_build_object(
    'activeActivities',(
      select count(*)::integer
      from erp_supply.workforce_activities a
      left join erp_supply.workforce_profile_policies wp
        on wp.profile_id=a.assignee_profile_id and wp.active
      where a.organization_id=v_org
        and a.status in('IN_PROGRESS','BLOCKED')
        and not coalesce(wp.exclude_from_occupancy_metrics,false)
    ),
    'occupiedPeople',(
      select count(*)::integer
      from people_rows p
      where p.occupancy in('OCCUPIED','BLOCKED') and not p.excluded_occupancy
    ),
    'availablePeople',(
      select count(*)::integer
      from people_rows p
      where p.occupancy='AVAILABLE' and not p.excluded_occupancy
    ),
    'blockedActivities',(
      select count(*)::integer
      from erp_supply.workforce_activities a
      left join erp_supply.workforce_profile_policies wp
        on wp.profile_id=a.assignee_profile_id and wp.active
      where a.organization_id=v_org
        and a.status='BLOCKED'
        and not coalesce(wp.exclude_from_occupancy_metrics,false)
    ),
    'operationalOrders',(select count(*)::integer from operational_orders),
    'completedActivities',(
      select count(*)::integer
      from activity_stats s
      left join erp_supply.workforce_profile_policies wp
        on wp.profile_id=s.assignee_profile_id and wp.active
      where s.status='COMPLETED'
        and not coalesce(wp.exclude_from_time_metrics,false)
    ),
    'averageActivityMinutes',coalesce((
      select round(avg(s.productive_seconds/60.0),2)
      from activity_stats s
      left join erp_supply.workforce_profile_policies wp
        on wp.profile_id=s.assignee_profile_id and wp.active
      where s.status='COMPLETED'
        and not coalesce(wp.exclude_from_time_metrics,false)
    ),0),
    'averageMinutesByStep',coalesce((
      select jsonb_object_agg(step_code,average_minutes order by step_code)
      from averages_by_step
    ),'{}'::jsonb),
    'ordersByStep',coalesce((
      select jsonb_object_agg(step_code,total order by step_code)
      from order_counts_by_step
    ),'{}'::jsonb),
    'people',coalesce((
      select jsonb_agg(jsonb_build_object(
        'profileId',p.profile_id,
        'name',p.name,
        'occupancy',p.occupancy,
        'orderId',p.current_order_id,
        'orderNumber',p.current_order_number,
        'activityTitle',p.current_activity_title,
        'activeBusinessMinutes',round(p.productive_seconds/60.0,2),
        'blockedBusinessMinutes',round(p.blocked_seconds/60.0,2),
        'completedActivities',p.completed,
        'inactivityMinutes',p.inactivity_minutes,
        'excludedFromOccupancyMetrics',p.excluded_occupancy,
        'excludedFromTimeMetrics',p.excluded_time
      ) order by p.name)
      from people_rows p
    ),'[]'::jsonb),
    'orders',coalesce((
      select jsonb_agg(jsonb_build_object(
        'orderId',o.order_id,
        'orderNumber',o.order_number,
        'stepCode',o.step_code,
        'responsibleProfileId',o.responsible_profile_id,
        'responsibleName',o.responsible_name,
        'sellerProfileId',o.seller_profile_id,
        'sellerName',o.seller_name,
        'workforceActivityId',o.workforce_activity_id,
        'workforceStatus',o.workforce_status,
        'businessMinutes',round(o.productive_seconds/60.0,2)
      ) order by o.order_number)
      from operational_orders o
    ),'[]'::jsonb),
    'contractVersion','1.0.0'
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.erp_x_order_workforce_indicators(date,date) from public,anon;
grant execute on function public.erp_x_order_workforce_indicators(date,date) to authenticated;

commit;

begin;

create or replace function erp_private.workforce_lock_idempotency(
  p_organization_id uuid,
  p_idempotency_key text
)
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $
begin
  if nullif(trim(p_idempotency_key),'') is null then
    raise exception 'La clave de idempotencia es obligatoria' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text||':'||trim(p_idempotency_key),0)
  );
end;
$;

create or replace function erp_private.workforce_can_manage()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  select erp_private.can_access_module('workforce','admin')
      or erp_private.can_access_module('workforce','approve')
$$;

create or replace function erp_private.workforce_can_manage_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  select p_profile_id=erp_private.current_profile_id()
      or (
        erp_private.workforce_can_manage()
        and exists(
          select 1
          from erp_supply.profiles p
          where p.id=p_profile_id
            and p.organization_id=erp_private.current_org_id()
            and p.active
            and not p.is_system
        )
      )
$$;

create or replace function erp_private.workforce_is_working_instant(
  p_organization_id uuid,
  p_moment timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  with ctx as(
    select coalesce(o.timezone,'America/Bogota') timezone
    from erp_supply.organizations o
    where o.id=p_organization_id
  ),
  local_moment as(
    select
      (p_moment at time zone timezone)::date work_date,
      (p_moment at time zone timezone)::time work_time,
      extract(isodow from (p_moment at time zone timezone))::smallint weekday
    from ctx
  )
  select exists(
    select 1
    from local_moment lm
    join erp_supply.workforce_schedule_segments s
      on s.organization_id=p_organization_id
     and s.iso_weekday=lm.weekday
     and s.active
     and lm.work_time>=s.start_time
     and lm.work_time<s.end_time
    where not exists(
      select 1
      from erp_supply.workforce_holidays h
      where h.organization_id=p_organization_id
        and h.holiday_date=lm.work_date
    )
  )
$$;

create or replace function erp_private.workforce_business_seconds(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  with ctx as(
    select coalesce(o.timezone,'America/Bogota') timezone
    from erp_supply.organizations o
    where o.id=p_organization_id
  ),
  local_range as(
    select
      (p_start at time zone timezone)::date start_date,
      (p_end at time zone timezone)::date end_date,
      timezone
    from ctx
  ),
  days as(
    select d::date work_date,lr.timezone
    from local_range lr,
         lateral generate_series(lr.start_date,lr.end_date,interval '1 day') d
  ),
  segments as(
    select
      greatest(
        p_start,
        (d.work_date+s.start_time) at time zone d.timezone
      ) seg_start,
      least(
        p_end,
        (d.work_date+s.end_time) at time zone d.timezone
      ) seg_end
    from days d
    join erp_supply.workforce_schedule_segments s
      on s.organization_id=p_organization_id
     and s.iso_weekday=extract(isodow from d.work_date)::smallint
     and s.active
    where not exists(
      select 1
      from erp_supply.workforce_holidays h
      where h.organization_id=p_organization_id
        and h.holiday_date=d.work_date
    )
  )
  select coalesce(sum(extract(epoch from(seg_end-seg_start)))::bigint,0)
  from segments
  where seg_end>seg_start
$$;

create or replace function erp_private.workforce_evidence_complete(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, erp_supply
as $$
  select case c.evidence_policy
    when 'NONE' then true
    when 'FINAL_PHOTO' then exists(
      select 1 from erp_supply.workforce_activity_evidence e
      where e.activity_id=a.id and e.evidence_type='FINAL_PHOTO'
        and coalesce(e.mime_type,'') like 'image/%'
    )
    when 'BEFORE_AFTER' then
      exists(
        select 1 from erp_supply.workforce_activity_evidence e
        where e.activity_id=a.id and e.evidence_type='BEFORE_PHOTO'
          and coalesce(e.mime_type,'') like 'image/%'
      )
      and exists(
        select 1 from erp_supply.workforce_activity_evidence e
        where e.activity_id=a.id and e.evidence_type='AFTER_PHOTO'
          and coalesce(e.mime_type,'') like 'image/%'
      )
    when 'FILE' then exists(
      select 1 from erp_supply.workforce_activity_evidence e
      where e.activity_id=a.id and e.evidence_type='FILE'
    )
    when 'LINK' then exists(
      select 1 from erp_supply.workforce_activity_evidence e
      where e.activity_id=a.id and e.evidence_type='LINK'
    )
    when 'ERP_REFERENCE' then exists(
      select 1 from erp_supply.workforce_activity_evidence e
      where e.activity_id=a.id and e.evidence_type='ERP_REFERENCE'
    )
    else false
  end
  from erp_supply.workforce_activities a
  join erp_supply.workforce_activity_catalog c on c.id=a.catalog_id
  where a.id=p_activity_id
$$;

create or replace function erp_private.workforce_time_signal(p_activity_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  select case
    when a.actual_start is null then 'NORMAL'
    when erp_private.workforce_business_seconds(
      a.organization_id,
      a.actual_start,
      coalesce(a.actual_end,now())
    ) > 3600 then 'OVER_60_MINUTES'
    else 'NORMAL'
  end
  from erp_supply.workforce_activities a
  where a.id=p_activity_id
$;

create or replace function erp_private.workforce_occupancy_status(
  p_profile_id uuid,
  p_moment timestamptz default now()
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
declare
  v_org uuid;
  v_status text;
begin
  select p.organization_id into v_org
  from erp_supply.profiles p
  where p.id=p_profile_id and p.active;

  if v_org is null then
    return 'OUT_OF_SCHEDULE';
  end if;

  if not erp_private.workforce_is_working_instant(v_org,p_moment) then
    return 'OUT_OF_SCHEDULE';
  end if;

  select case
    when a.status='BLOCKED' then 'BLOCKED'
    else 'OCCUPIED'
  end into v_status
  from erp_supply.workforce_activities a
  where a.organization_id=v_org
    and a.assignee_profile_id=p_profile_id
    and (
      (a.status in('IN_PROGRESS','BLOCKED') and a.actual_start<=p_moment)
      or (
        a.status='PLANNED'
        and a.planned_start<=p_moment
        and a.planned_end>p_moment
      )
    )
  order by case when a.status='BLOCKED' then 0 when a.status='IN_PROGRESS' then 1 else 2 end
  limit 1;

  return coalesce(v_status,'AVAILABLE');
end;
$$;

create or replace function erp_private.workforce_pick_assignee(
  p_catalog_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, erp_supply, erp_private
as $$
  with catalog as(
    select c.organization_id,c.allowed_roles
    from erp_supply.workforce_activity_catalog c
    where c.id=p_catalog_id and c.active
  ),
  candidates as(
    select p.id
    from erp_supply.profiles p
    join catalog c on c.organization_id=p.organization_id
    where p.active
      and not p.is_system
      and (
        cardinality(c.allowed_roles)=0
        or exists(
          select 1
          from erp_supply.profile_roles pr
          where pr.profile_id=p.id
            and pr.role_code=any(c.allowed_roles)
        )
      )
      and not exists(
        select 1
        from erp_supply.workforce_activities a
        where a.organization_id=p.organization_id
          and a.assignee_profile_id=p.id
          and a.status in('PLANNED','IN_PROGRESS','BLOCKED')
          and tstzrange(a.planned_start,a.planned_end,'[)') && tstzrange(p_start,p_end,'[)')
      )
  )
  select c.id
  from candidates c
  order by (
    select count(*)
    from erp_supply.workforce_activities a
    where a.assignee_profile_id=c.id
      and a.status in('PLANNED','IN_PROGRESS','BLOCKED')
      and a.planned_start::date=p_start::date
  ),c.id
  limit 1
$$;

revoke all on function erp_private.workforce_lock_idempotency(uuid,text) from public,anon;
revoke all on function erp_private.workforce_can_manage() from public,anon;
revoke all on function erp_private.workforce_can_manage_profile(uuid) from public,anon;
revoke all on function erp_private.workforce_is_working_instant(uuid,timestamptz) from public,anon;
revoke all on function erp_private.workforce_business_seconds(uuid,timestamptz,timestamptz) from public,anon;
revoke all on function erp_private.workforce_evidence_complete(uuid) from public,anon;
revoke all on function erp_private.workforce_time_signal(uuid) from public,anon;
revoke all on function erp_private.workforce_occupancy_status(uuid,timestamptz) from public,anon;
revoke all on function erp_private.workforce_pick_assignee(uuid,timestamptz,timestamptz) from public,anon;

grant execute on function erp_private.workforce_lock_idempotency(uuid,text) to authenticated;
grant execute on function erp_private.workforce_can_manage() to authenticated;
grant execute on function erp_private.workforce_can_manage_profile(uuid) to authenticated;
grant execute on function erp_private.workforce_is_working_instant(uuid,timestamptz) to authenticated;
grant execute on function erp_private.workforce_business_seconds(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function erp_private.workforce_evidence_complete(uuid) to authenticated;
grant execute on function erp_private.workforce_time_signal(uuid) to authenticated;
grant execute on function erp_private.workforce_occupancy_status(uuid,timestamptz) to authenticated;
grant execute on function erp_private.workforce_pick_assignee(uuid,timestamptz,timestamptz) to authenticated;

create policy workforce_catalog_read
on erp_supply.workforce_activity_catalog
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_activities_read
on erp_supply.workforce_activities
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_activities_insert
on erp_supply.workforce_activities
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and created_by=erp_private.current_profile_id()
  and assigned_by=erp_private.current_profile_id()
  and erp_private.can_access_module('workforce','create')
  and erp_private.workforce_can_manage_profile(assignee_profile_id)
  and exists(
    select 1 from erp_supply.workforce_activity_catalog c
    where c.id=catalog_id and c.organization_id=erp_private.current_org_id()
  )
  and (
    order_id is null
    or exists(
      select 1 from erp_supply.orders o
      where o.id=order_id and o.organization_id=erp_private.current_org_id()
    )
  )
  and (
    order_task_id is null
    or exists(
      select 1 from erp_supply.order_tasks t
      join erp_supply.orders o on o.id=t.order_id
      where t.id=order_task_id
        and o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

create policy workforce_activities_update
on erp_supply.workforce_activities
for update to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.workforce_can_manage_profile(assignee_profile_id)
)
with check (
  organization_id=erp_private.current_org_id()
  and erp_private.workforce_can_manage_profile(assignee_profile_id)
  and exists(
    select 1 from erp_supply.workforce_activity_catalog c
    where c.id=catalog_id and c.organization_id=erp_private.current_org_id()
  )
  and (
    order_id is null
    or exists(
      select 1 from erp_supply.orders o
      where o.id=order_id and o.organization_id=erp_private.current_org_id()
    )
  )
  and (
    order_task_id is null
    or exists(
      select 1 from erp_supply.order_tasks t
      join erp_supply.orders o on o.id=t.order_id
      where t.id=order_task_id
        and o.id=order_id
        and o.organization_id=erp_private.current_org_id()
    )
  )
);

create policy workforce_evidence_read
on erp_supply.workforce_activity_evidence
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_evidence_insert
on erp_supply.workforce_activity_evidence
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and uploaded_by=erp_private.current_profile_id()
  and exists(
    select 1
    from erp_supply.workforce_activities a
    where a.id=activity_id
      and a.organization_id=erp_private.current_org_id()
      and erp_private.workforce_can_manage_profile(a.assignee_profile_id)
  )
);

create policy workforce_events_read
on erp_supply.workforce_activity_events
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_events_insert
on erp_supply.workforce_activity_events
for insert to authenticated
with check (
  organization_id=erp_private.current_org_id()
  and actor_profile_id=erp_private.current_profile_id()
  and exists(
    select 1 from erp_supply.workforce_activities a
    where a.id=activity_id and a.organization_id=erp_private.current_org_id()
  )
);

create policy workforce_profile_policies_read
on erp_supply.workforce_profile_policies
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_profile_policies_write
on erp_supply.workforce_profile_policies
for all to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.workforce_can_manage()
)
with check (
  organization_id=erp_private.current_org_id()
  and erp_private.workforce_can_manage()
  and exists(
    select 1 from erp_supply.profiles p
    where p.id=profile_id and p.organization_id=erp_private.current_org_id()
  )
);

create policy workforce_segments_read
on erp_supply.workforce_schedule_segments
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

create policy workforce_holidays_read
on erp_supply.workforce_holidays
for select to authenticated
using (
  organization_id=erp_private.current_org_id()
  and erp_private.can_access_module('workforce','read')
);

grant select on erp_supply.workforce_activity_catalog to authenticated;
grant select,insert,update on erp_supply.workforce_activities to authenticated;
grant select,insert on erp_supply.workforce_activity_evidence to authenticated;
grant select,insert on erp_supply.workforce_activity_events to authenticated;
grant select,insert,update,delete on erp_supply.workforce_profile_policies to authenticated;
grant select on erp_supply.workforce_schedule_segments to authenticated;
grant select on erp_supply.workforce_holidays to authenticated;
grant usage,select on sequence erp_supply.workforce_activity_events_id_seq to authenticated;

commit;

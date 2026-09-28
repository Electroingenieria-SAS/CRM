begin;

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

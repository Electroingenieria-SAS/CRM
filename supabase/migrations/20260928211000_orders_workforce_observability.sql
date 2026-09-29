begin;

create or replace function public.erp_x_order_workforce_binding(
  p_order_task_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'orderTaskId',x.order_task_id,
        'orderId',x.order_id,
        'workforceActivityId',x.workforce_activity_id,
        'status',x.status,
        'lastIntegrationEvent',x.integration_event,
        'processedAt',x.processed_at,
        'contractVersion','1.0.0'
      )
      from erp_supply.order_workforce_outbox x
      where x.organization_id=erp_private.current_org_id()
        and x.order_task_id=p_order_task_id
        and x.status='PROCESSED'
        and x.workforce_activity_id is not null
      order by x.processed_at desc,x.created_at desc
      limit 1
    ),
    jsonb_build_object(
      'orderTaskId',p_order_task_id,
      'workforceActivityId',null,
      'status','UNBOUND',
      'contractVersion','1.0.0'
    )
  )
$$;

create or replace function public.erp_x_order_workforce_health()
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
  with scoped as (
    select x.*
    from erp_supply.order_workforce_outbox x
    where x.organization_id=erp_private.current_org_id()
  ),
  by_status as (
    select status,count(*)::integer total
    from scoped
    group by status
  ),
  by_step as (
    select step_code,count(*)::integer total
    from scoped
    where status in('PENDING','PROCESSING','FAILED')
    group by step_code
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'pending',coalesce((select total from by_status where status='PENDING'),0),
      'processing',coalesce((select total from by_status where status='PROCESSING'),0),
      'processed',coalesce((select total from by_status where status='PROCESSED'),0),
      'failed',coalesce((select total from by_status where status='FAILED'),0),
      'staleProcessing',(
        select count(*)::integer
        from scoped
        where status='PROCESSING'
          and locked_at < now()-interval '5 minutes'
      )
    ),
    'pendingByStep',coalesce(
      (select jsonb_object_agg(step_code,total order by step_code) from by_step),
      '{}'::jsonb
    ),
    'oldestPendingAt',(
      select min(created_at)
      from scoped
      where status in('PENDING','FAILED')
    ),
    'contractVersion','1.0.0'
  )
$$;

revoke all on function public.erp_x_order_workforce_binding(uuid) from public,anon;
revoke all on function public.erp_x_order_workforce_health() from public,anon;

grant execute on function public.erp_x_order_workforce_binding(uuid) to authenticated;
grant execute on function public.erp_x_order_workforce_health() to authenticated;

commit;

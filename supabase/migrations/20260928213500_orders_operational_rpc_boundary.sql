begin;

-- Operational workers must not receive broad orders.update just to execute
-- the narrow lifecycle actions granted by step_roles. These RPCs remain
-- responsible for organization, assignee, role, version and idempotency checks.
alter function public.erp_x_claim_order_task(uuid,integer,text) security definer;
alter function public.erp_x_start_order_task(uuid,integer,text) security definer;
alter function public.erp_x_block_order_task(uuid,text,text,integer,text) security definer;
alter function public.erp_x_resume_order_task(uuid,text,integer,text) security definer;
alter function public.erp_x_complete_order_task(uuid,text,text,integer,text) security definer;

revoke all on function public.erp_x_claim_order_task(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_start_order_task(uuid,integer,text) from public,anon;
revoke all on function public.erp_x_block_order_task(uuid,text,text,integer,text) from public,anon;
revoke all on function public.erp_x_resume_order_task(uuid,text,integer,text) from public,anon;
revoke all on function public.erp_x_complete_order_task(uuid,text,text,integer,text) from public,anon;

grant execute on function public.erp_x_claim_order_task(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_start_order_task(uuid,integer,text) to authenticated;
grant execute on function public.erp_x_block_order_task(uuid,text,text,integer,text) to authenticated;
grant execute on function public.erp_x_resume_order_task(uuid,text,integer,text) to authenticated;
grant execute on function public.erp_x_complete_order_task(uuid,text,text,integer,text) to authenticated;

comment on function public.erp_x_claim_order_task(uuid,integer,text) is
  'Narrow operational write boundary: authorization is enforced by workflow_actor_can; broad orders.update is not required.';
comment on function public.erp_x_start_order_task(uuid,integer,text) is
  'Narrow operational write boundary: authorization is enforced by workflow_actor_can; broad orders.update is not required.';
comment on function public.erp_x_block_order_task(uuid,text,text,integer,text) is
  'Narrow operational write boundary: authorization is enforced by workflow_actor_can; broad orders.update is not required.';
comment on function public.erp_x_resume_order_task(uuid,text,integer,text) is
  'Narrow operational write boundary: authorization is enforced by workflow_actor_can; broad orders.update is not required.';
comment on function public.erp_x_complete_order_task(uuid,text,text,integer,text) is
  'Narrow operational write boundary: authorization is enforced by workflow_actor_can; broad orders.update is not required.';

commit;

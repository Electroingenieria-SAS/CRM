begin;

alter table erp_supply.orders
  add constraint uq_orders_id_organization unique (id,organization_id);

alter table erp_supply.order_tasks
  add constraint uq_order_tasks_id_order unique (id,order_id);

alter table erp_supply.order_blocks
  add constraint fk_order_blocks_order_scope
  foreign key (order_id,organization_id)
  references erp_supply.orders(id,organization_id);

alter table erp_supply.order_blocks
  add constraint fk_order_blocks_task_scope
  foreign key (task_id,order_id)
  references erp_supply.order_tasks(id,order_id);

alter table erp_supply.order_issues
  add constraint fk_order_issues_order_scope
  foreign key (order_id,organization_id)
  references erp_supply.orders(id,organization_id);

alter table erp_supply.order_issues
  add constraint fk_order_issues_task_scope
  foreign key (task_id,order_id)
  references erp_supply.order_tasks(id,order_id);

alter table erp_supply.order_evidence
  add constraint fk_order_evidence_order_scope
  foreign key (order_id,organization_id)
  references erp_supply.orders(id,organization_id);

alter table erp_supply.order_evidence
  add constraint fk_order_evidence_task_scope
  foreign key (task_id,order_id)
  references erp_supply.order_tasks(id,order_id);

alter table erp_supply.task_sessions
  add constraint fk_task_sessions_order_scope
  foreign key (order_id,organization_id)
  references erp_supply.orders(id,organization_id);

alter table erp_supply.task_sessions
  add constraint fk_task_sessions_task_scope
  foreign key (task_id,order_id)
  references erp_supply.order_tasks(id,order_id);

alter table erp_supply.order_tasks
  add constraint chk_order_task_timestamps
  check (
    (assigned_at is null or assigned_at >= created_at)
    and (started_at is null or started_at >= created_at)
    and (completed_at is null or completed_at >= created_at)
    and (started_at is null or completed_at is null or completed_at >= started_at)
  );

create index idx_order_tasks_operational_queue
on erp_supply.order_tasks(step_code,status,assigned_profile_id,created_at)
where status in('QUEUED','ASSIGNED','IN_PROGRESS','WAITING','BLOCKED');

commit;

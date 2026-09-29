begin;

insert into erp_supply.modules(code,name,description,icon,sort_order,active) values
('dashboard','Centro de operación','KPIs, alertas y colas operativas','layout-dashboard',10,true),
('vsm','VSM y tiempos','Lead time, tiempos de proceso, espera y bloqueo','activity',150,true),
('reports','Reportes','Explorador analítico y exportaciones controladas','chart-no-axes-combined',160,true),
('imports','Importaciones','Carga histórica validada y trazable','file-up',170,true)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=true;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'dashboard',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.active
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'vsm',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.code in (
  'auditoria','coordinador_logistico','gerencia','jefe_logistica',
  'lider_logistica','super_admin'
)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select r.code,'reports',true,false,false,false,(r.code='super_admin')
from erp_supply.roles r
where r.code in (
  'auditoria','cartera','caja','compras','coordinador_logistico','gerencia',
  'jefe_logistica','lider_logistica','super_admin','ventas'
)
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_admin=excluded.can_admin;

insert into erp_supply.role_module_permissions(
  role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
)
select
  r.code,
  'imports',
  true,
  (r.code='super_admin'),
  (r.code='super_admin'),
  (r.code='super_admin'),
  (r.code='super_admin')
from erp_supply.roles r
where r.code in ('auditoria','gerencia','super_admin')
on conflict (role_code,module_code) do update set
  can_read=excluded.can_read,
  can_create=excluded.can_create,
  can_update=excluded.can_update,
  can_approve=excluded.can_approve,
  can_admin=excluded.can_admin;

create table erp_supply.analytics_kpi_catalog (
  code text primary key,
  name text not null,
  definition text not null,
  formula text not null,
  source text not null,
  temporal_scope text not null,
  supported_filters text[] not null default '{}',
  limitations text,
  active boolean not null default true,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

insert into erp_supply.analytics_kpi_catalog(
  code,name,definition,formula,source,temporal_scope,supported_filters,limitations,sort_order
) values
(
  'ORDERS_TOTAL','Pedidos totales',
  'Pedidos creados dentro del rango y visibles para la organización.',
  'count(orders)',
  'erp_supply.orders',
  'created_at dentro del rango local de la organización',
  array['date','client','seller','step','status','route','segment'],
  null,10
),
(
  'ORDERS_ACTIVE','Pedidos activos',
  'Pedidos del rango que no están cerrados ni cancelados.',
  'count(orders where status not in CLOSED,CANCELLED)',
  'erp_supply.orders',
  'created_at dentro del rango local de la organización',
  array['date','client','seller','step','status','route','segment'],
  null,20
),
(
  'ORDERS_BLOCKED','Pedidos bloqueados',
  'Pedidos con estado BLOCKED o un bloqueo operativo abierto.',
  'count(distinct order_id)',
  'erp_supply.orders + erp_supply.order_blocks',
  'estado actual de pedidos del rango',
  array['date','client','seller','step','route','segment'],
  null,30
),
(
  'FINANCIAL_PENDING','Pendientes financieros',
  'Pedidos cuya etapa actual corresponde a Cartera, Caja o Caja de facturación.',
  'count(orders where current_step_code in CARTERA,CAJA,CAJA_FACTURACION)',
  'erp_supply.orders.current_step_code',
  'estado actual de pedidos del rango',
  array['date','client','seller','status','route','segment'],
  'Indicador operacional; no sustituye saldos contables ni decisiones del dominio Finance.',40
),
(
  'WORKFORCE_OCCUPIED','Personas ocupadas',
  'Personas ocupadas o bloqueadas según el indicador oficial de Workforce.',
  'erp_x_order_workforce_indicators.occupiedPeople',
  'public.erp_x_order_workforce_indicators',
  'rango solicitado, máximo definido por Workforce',
  array['date'],
  'Excluye perfiles configurados con exclude_from_occupancy_metrics.',50
),
(
  'WORKFORCE_AVAILABLE','Personas disponibles',
  'Personas disponibles según el indicador oficial de Workforce.',
  'erp_x_order_workforce_indicators.availablePeople',
  'public.erp_x_order_workforce_indicators',
  'rango solicitado, máximo definido por Workforce',
  array['date'],
  'Excluye perfiles configurados con exclude_from_occupancy_metrics.',60
),
(
  'VSM_LEAD_TIME','Lead time',
  'Tiempo laboral transcurrido desde creación del pedido hasta cierre o instante de corte.',
  'business_seconds(order.created_at, order.closed_at or now)',
  'orders + erp_private.workforce_business_seconds',
  'por pedido y agregado por rango',
  array['date','client','seller','step','status','route','segment'],
  'No se denomina tiempo productivo.',70
),
(
  'VSM_WAITING_TIME','Waiting time',
  'Tiempo laboral desde creación de una etapa hasta su inicio efectivo.',
  'business_seconds(task.created_at, task.started_at)',
  'erp_supply.order_tasks',
  'por etapa dentro del rango',
  array['date','client','seller','step','status','route','segment'],
  null,80
),
(
  'VSM_PROCESSING_TIME','Processing time',
  'Tiempo laboral iniciado en la etapa menos intervalos de bloqueo.',
  'business_seconds(task.started_at, task.completed_at or now) - blocked_seconds',
  'order_tasks + order_blocks',
  'por etapa dentro del rango',
  array['date','client','seller','step','status','route','segment'],
  'Workforce mantiene su propio indicador productivo; este KPI mide ciclo de etapa del pedido.',90
),
(
  'VSM_BLOCKED_TIME','Blocked time',
  'Tiempo laboral acumulado en bloqueos explícitos de una etapa.',
  'sum(business_seconds(blocked_at, resolved_at or now))',
  'erp_supply.order_blocks',
  'por etapa dentro del rango',
  array['date','client','seller','step','status','route','segment'],
  null,100
)
on conflict (code) do update set
  name=excluded.name,
  definition=excluded.definition,
  formula=excluded.formula,
  source=excluded.source,
  temporal_scope=excluded.temporal_scope,
  supported_filters=excluded.supported_filters,
  limitations=excluded.limitations,
  active=true,
  sort_order=excluded.sort_order,
  updated_at=now();

alter table erp_supply.analytics_kpi_catalog enable row level security;

create policy analytics_kpi_catalog_read
on erp_supply.analytics_kpi_catalog
for select to authenticated
using (
  active
  and (
    erp_private.can_access_module('dashboard','read')
    or erp_private.can_access_module('vsm','read')
    or erp_private.can_access_module('reports','read')
  )
);

grant select on erp_supply.analytics_kpi_catalog to authenticated;

create or replace function erp_private.analytics_stage_metrics(
  p_organization_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_id uuid,
  order_number text,
  customer_id uuid,
  client_name text,
  seller_profile_id uuid,
  step_code text,
  step_name text,
  sequence_no integer,
  task_status text,
  task_created_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  waiting_seconds bigint,
  processing_seconds bigint,
  blocked_seconds bigint,
  total_seconds bigint
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if p_organization_id is null
     or p_organization_id is distinct from erp_private.current_org_id() then
    raise exception 'Organización analítica no autorizada' using errcode='42501';
  end if;

  if p_from is null or p_to is null or p_to<=p_from then
    raise exception 'Rango analítico inválido' using errcode='22023';
  end if;

  return query
  with task_rows as (
    select
      o.id order_id,
      o.order_number,
      o.customer_id,
      o.client_name,
      o.seller_profile_id,
      t.id task_id,
      t.step_code,
      ws.name step_name,
      t.sequence_no,
      t.status task_status,
      t.created_at task_created_at,
      t.started_at,
      t.completed_at
    from erp_supply.orders o
    join erp_supply.order_tasks t on t.order_id=o.id
    join erp_supply.workflow_steps ws on ws.code=t.step_code
    where o.organization_id=p_organization_id
      and t.created_at<p_to
      and coalesce(t.completed_at,now())>=p_from
      and not o.is_test
  ),
  blocked as (
    select
      b.task_id,
      coalesce(sum(
        case
          when least(coalesce(b.resolved_at,now()),p_to)>greatest(b.blocked_at,p_from)
          then erp_private.workforce_business_seconds(
            p_organization_id,
            greatest(b.blocked_at,p_from),
            least(coalesce(b.resolved_at,now()),p_to)
          )
          else 0
        end
      ),0)::bigint blocked_seconds
    from erp_supply.order_blocks b
    where b.organization_id=p_organization_id
      and b.blocked_at<p_to
      and coalesce(b.resolved_at,now())>=p_from
    group by b.task_id
  )
  select
    t.order_id,
    t.order_number,
    t.customer_id,
    t.client_name,
    t.seller_profile_id,
    t.step_code,
    t.step_name,
    t.sequence_no,
    t.task_status,
    t.task_created_at,
    t.started_at,
    t.completed_at,
    case
      when t.started_at is null
        then erp_private.workforce_business_seconds(
          p_organization_id,
          greatest(t.task_created_at,p_from),
          least(coalesce(t.completed_at,now()),p_to)
        )
      else erp_private.workforce_business_seconds(
        p_organization_id,
        greatest(t.task_created_at,p_from),
        least(t.started_at,p_to)
      )
    end::bigint waiting_seconds,
    case
      when t.started_at is null then 0
      else greatest(
        erp_private.workforce_business_seconds(
          p_organization_id,
          greatest(t.started_at,p_from),
          least(coalesce(t.completed_at,now()),p_to)
        )-coalesce(b.blocked_seconds,0),
        0
      )
    end::bigint processing_seconds,
    coalesce(b.blocked_seconds,0)::bigint blocked_seconds,
    erp_private.workforce_business_seconds(
      p_organization_id,
      greatest(t.task_created_at,p_from),
      least(coalesce(t.completed_at,now()),p_to)
    )::bigint total_seconds
  from task_rows t
  left join blocked b on b.task_id=t.task_id;
end;
$$;

revoke all on function erp_private.analytics_stage_metrics(uuid,timestamptz,timestamptz)
from public,anon;
grant execute on function erp_private.analytics_stage_metrics(uuid,timestamptz,timestamptz)
to authenticated;

create index if not exists idx_order_tasks_analytics_time
on erp_supply.order_tasks(order_id,created_at,completed_at,step_code,status);

create index if not exists idx_order_blocks_analytics_time
on erp_supply.order_blocks(organization_id,task_id,blocked_at,resolved_at);

commit;

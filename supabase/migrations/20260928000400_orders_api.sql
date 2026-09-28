begin;

create or replace function public.erp_x_session()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_profile erp_supply.profiles%rowtype;
  v_org erp_supply.organizations%rowtype;
  v_roles text[];
  v_modules jsonb;
begin
  select * into v_profile
  from erp_supply.profiles
  where id = erp_private.current_profile_id();

  if not found then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  select * into v_org
  from erp_supply.organizations
  where id = v_profile.organization_id;

  v_roles := erp_private.current_roles();

  select coalesce(jsonb_agg(x.item order by x.sort_order), '[]'::jsonb)
  into v_modules
  from (
    select
      m.sort_order,
      jsonb_build_object(
        'code',m.code,
        'name',m.name,
        'description',m.description,
        'icon',m.icon,
        'sortOrder',m.sort_order,
        'canRead',bool_or(mp.can_read),
        'canCreate',bool_or(mp.can_create),
        'canUpdate',bool_or(mp.can_update),
        'canApprove',bool_or(mp.can_approve),
        'canAdmin',bool_or(mp.can_admin)
      ) item
    from erp_supply.modules m
    join erp_supply.role_module_permissions mp
      on mp.module_code=m.code
     and mp.role_code=any(v_roles)
    where m.active
    group by m.code,m.name,m.description,m.icon,m.sort_order
  ) x;

  return jsonb_build_object(
    'profile',jsonb_build_object(
      'id',v_profile.id,
      'email',v_profile.email,
      'name',v_profile.display_name,
      'employeeCode',v_profile.employee_code,
      'roles',v_roles,
      'preferences',v_profile.preferences
    ),
    'organization',jsonb_build_object(
      'id',v_org.id,
      'code',v_org.code,
      'name',v_org.name,
      'timezone',v_org.timezone,
      'settings',v_org.settings
    ),
    'modules',v_modules,
    'catalogs',jsonb_build_object(
      'orderTypes',(select coalesce(jsonb_agg(to_jsonb(t) order by sort_order),'[]'::jsonb) from erp_supply.order_types t where active),
      'paymentConditions',(select coalesce(jsonb_agg(to_jsonb(p) order by sort_order),'[]'::jsonb) from erp_supply.payment_conditions p where active),
      'deliveryRoutes',(select coalesce(jsonb_agg(to_jsonb(r) order by sort_order),'[]'::jsonb) from erp_supply.delivery_routes r where active),
      'steps',(select coalesce(jsonb_agg(to_jsonb(s) order by sort_order),'[]'::jsonb) from erp_supply.workflow_steps s where active),
      'priorities',jsonb_build_array('LOW','MEDIUM','HIGH','URGENT','CRITICAL')
    ),
    'serverTime',now(),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_list_orders(
  p_search text default null,
  p_step text default null,
  p_status text default null,
  p_order_type text default null,
  p_route text default null,
  p_page integer default 1,
  p_page_size integer default 50,
  p_include_history boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,50),1),100);
  v_total bigint;
  v_items jsonb;
begin
  if not erp_private.can_access_module('orders','read') then
    raise exception 'No autorizado para consultar pedidos' using errcode='42501';
  end if;

  with filtered as (
    select
      o.*,
      ws.name step_name,
      seller.display_name seller_name,
      assignee.display_name assignee_name
    from erp_supply.orders o
    join erp_supply.workflow_steps ws on ws.code=o.current_step_code
    left join erp_supply.profiles seller on seller.id=o.seller_profile_id
    left join erp_supply.profiles assignee on assignee.id=o.current_assignee_id
    where (p_include_history or not o.is_history)
      and (
        nullif(trim(p_search),'') is null
        or lower(o.order_number||' '||o.client_name||' '||coalesce(o.external_reference,'')) like '%'||lower(trim(p_search))||'%'
      )
      and (nullif(trim(p_step),'') is null or o.current_step_code=upper(trim(p_step)))
      and (nullif(trim(p_status),'') is null or o.status=upper(trim(p_status)))
      and (nullif(trim(p_order_type),'') is null or o.order_type_code=upper(trim(p_order_type)))
      and (nullif(trim(p_route),'') is null or o.delivery_route_code=upper(trim(p_route)))
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select
      o.*,
      ws.name step_name,
      seller.display_name seller_name,
      assignee.display_name assignee_name
    from erp_supply.orders o
    join erp_supply.workflow_steps ws on ws.code=o.current_step_code
    left join erp_supply.profiles seller on seller.id=o.seller_profile_id
    left join erp_supply.profiles assignee on assignee.id=o.current_assignee_id
    where (p_include_history or not o.is_history)
      and (
        nullif(trim(p_search),'') is null
        or lower(o.order_number||' '||o.client_name||' '||coalesce(o.external_reference,'')) like '%'||lower(trim(p_search))||'%'
      )
      and (nullif(trim(p_step),'') is null or o.current_step_code=upper(trim(p_step)))
      and (nullif(trim(p_status),'') is null or o.status=upper(trim(p_status)))
      and (nullif(trim(p_order_type),'') is null or o.order_type_code=upper(trim(p_order_type)))
      and (nullif(trim(p_route),'') is null or o.delivery_route_code=upper(trim(p_route)))
    order by o.updated_at desc
    offset (v_page-1)*v_size
    limit v_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'orderNumber',order_number,
    'externalReference',external_reference,
    'orderType',order_type_code,
    'paymentCondition',payment_condition_code,
    'route',delivery_route_code,
    'clientName',client_name,
    'currentStep',current_step_code,
    'stepName',step_name,
    'status',status,
    'priority',priority,
    'sellerId',seller_profile_id,
    'sellerName',seller_name,
    'assigneeId',current_assignee_id,
    'assigneeName',assignee_name,
    'isHistory',is_history,
    'createdAt',created_at,
    'updatedAt',updated_at,
    'version',version
  ) order by updated_at desc),'[]'::jsonb)
  into v_items
  from filtered;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,
      'pageSize',v_size,
      'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_order erp_supply.orders%rowtype;
begin
  select * into v_order
  from erp_supply.orders
  where id=p_order_id;

  if not found then
    raise exception 'Pedido no encontrado' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'order',to_jsonb(v_order),
    'items',(
      select coalesce(jsonb_agg(to_jsonb(i) order by i.line_number),'[]'::jsonb)
      from erp_supply.order_items i where i.order_id=p_order_id
    ),
    'tasks',(
      select coalesce(jsonb_agg(to_jsonb(t) order by t.sequence_no),'[]'::jsonb)
      from erp_supply.order_tasks t where t.order_id=p_order_id
    ),
    'events',(
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb)
      from erp_supply.order_events e where e.order_id=p_order_id
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_create_order(
  p_payload jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, erp_supply, erp_private
as $$
declare
  v_actor uuid := erp_private.current_profile_id();
  v_org uuid := erp_private.current_org_id();
  v_order_id uuid;
  v_task_id uuid;
  v_existing_order uuid;
  v_order_number text;
  v_order_type text;
  v_payment text;
  v_route text;
  v_client text;
  v_city text;
  v_address text;
  v_initial_step text;
  v_requires_purchase boolean;
  v_requires_cut boolean := false;
  v_has_credit_arrears boolean := false;
  v_held_by_cashier boolean := false;
  v_item jsonb;
  v_line integer := 0;
  v_quantity numeric;
  v_item_requires_cut boolean;
  v_cut_length numeric;
begin
  if v_actor is null or v_org is null then
    raise exception 'Usuario sin perfil operativo activo' using errcode='42501';
  end if;

  if not (
    erp_private.can_access_module('orders','create')
    or erp_private.can_access_module('sales','create')
  ) then
    raise exception 'No autorizado para crear pedidos' using errcode='42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'El pedido debe enviarse como un objeto válido';
  end if;

  v_order_number := nullif(trim(p_payload->>'orderNumber'),'');
  v_order_type := upper(nullif(trim(p_payload->>'orderType'),''));
  v_payment := upper(nullif(trim(p_payload->>'paymentCondition'),''));
  v_route := upper(nullif(trim(p_payload->>'deliveryRoute'),''));
  v_client := nullif(trim(p_payload->>'clientName'),'');
  v_city := nullif(trim(p_payload->>'clientCity'),'');
  v_address := nullif(trim(p_payload->>'clientAddress'),'');

  if v_order_number is null then raise exception 'Número de pedido requerido'; end if;
  if v_client is null then raise exception 'Cliente requerido'; end if;
  if v_city is null then raise exception 'Ciudad requerida'; end if;
  if v_address is null or length(v_address) < 5 then raise exception 'Dirección de entrega requerida'; end if;

  if not exists(select 1 from erp_supply.order_types where code=v_order_type and active) then
    raise exception 'Tipo de pedido inválido';
  end if;
  if not exists(select 1 from erp_supply.payment_conditions where code=v_payment and active) then
    raise exception 'Condición de pago inválida';
  end if;
  if not exists(select 1 from erp_supply.delivery_routes where code=v_route and active) then
    raise exception 'Modalidad de entrega inválida';
  end if;
  if jsonb_typeof(coalesce(p_payload->'items','[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then
    raise exception 'El pedido debe contener al menos un ítem';
  end if;

  if nullif(trim(p_idempotency_key),'') is not null then
    select e.order_id into v_existing_order
    from erp_supply.order_events e
    where e.organization_id=v_org
      and e.idempotency_key=trim(p_idempotency_key)
    limit 1;

    if v_existing_order is not null then
      return jsonb_build_object(
        'success',true,
        'idempotent',true,
        'orderId',v_existing_order,
        'contractVersion','1.0.0'
      );
    end if;
  end if;

  v_requires_purchase := coalesce(
    (p_payload->>'requiresPurchase')::boolean,
    (select requires_purchase_default from erp_supply.order_types where code=v_order_type),
    false
  );
  v_has_credit_arrears := coalesce((p_payload->>'hasCreditArrears')::boolean,false);
  v_held_by_cashier := coalesce((p_payload->>'heldByCashier')::boolean,false);

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_item_requires_cut := coalesce((v_item->>'requiresCut')::boolean,false);
    if v_item_requires_cut then v_requires_cut := true; end if;
  end loop;

  v_initial_step := erp_supply.initial_step(
    v_order_type,
    v_payment,
    v_requires_purchase,
    v_has_credit_arrears,
    v_held_by_cashier
  );

  insert into erp_supply.orders(
    organization_id,order_number,external_reference,order_type_code,
    payment_condition_code,delivery_route_code,client_name,client_document,
    client_city,client_address,client_phone,seller_profile_id,current_step_code,
    status,priority,requires_cut,requires_purchase,promised_at,requested_delivery_date,
    metadata
  )
  values(
    v_org,v_order_number,nullif(trim(p_payload->>'externalReference'),''),
    v_order_type,v_payment,v_route,v_client,nullif(trim(p_payload->>'clientDocument'),''),
    v_city,v_address,nullif(trim(p_payload->>'clientPhone'),''),
    v_actor,v_initial_step,'QUEUED','MEDIUM',v_requires_cut,v_requires_purchase,
    nullif(p_payload->>'promisedAt','')::timestamptz,
    nullif(p_payload->>'requestedDeliveryDate','')::date,
    jsonb_build_object(
      'prioritySource','DEFAULT_UNTIL_CUSTOMER_INTELLIGENCE',
      'clientDepartment',nullif(trim(p_payload->>'clientDepartment'),''),
      'routingVersion','1.0.0'
    ) || case
      when jsonb_typeof(coalesce(p_payload->'metadata','{}'::jsonb))='object'
      then coalesce(p_payload->'metadata','{}'::jsonb)
      else '{}'::jsonb
    end
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_line := v_line + 1;
    v_quantity := nullif(v_item->>'quantity','')::numeric;
    v_item_requires_cut := coalesce((v_item->>'requiresCut')::boolean,false);
    v_cut_length := nullif(v_item->>'requestedCutLength','')::numeric;

    if nullif(trim(v_item->>'description'),'') is null then
      raise exception 'La línea % no tiene descripción',v_line;
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Cantidad inválida en la línea %',v_line;
    end if;
    if v_item_requires_cut and (v_cut_length is null or v_cut_length <= 0) then
      raise exception 'La línea % requiere longitud de corte válida',v_line;
    end if;

    insert into erp_supply.order_items(
      order_id,line_number,sku,reference,description,quantity,unit,
      warehouse_location,requires_cut,requested_cut_length,dimensions,metadata
    )
    values(
      v_order_id,
      coalesce(nullif(v_item->>'lineNumber','')::integer,v_line),
      nullif(trim(v_item->>'sku'),''),
      nullif(trim(v_item->>'reference'),''),
      trim(v_item->>'description'),
      v_quantity,
      coalesce(nullif(trim(v_item->>'unit'),''),'UND'),
      nullif(trim(v_item->>'warehouseLocation'),''),
      v_item_requires_cut,
      v_cut_length,
      case when jsonb_typeof(coalesce(v_item->'dimensions','{}'::jsonb))='object'
        then coalesce(v_item->'dimensions','{}'::jsonb) else '{}'::jsonb end,
      case when jsonb_typeof(coalesce(v_item->'metadata','{}'::jsonb))='object'
        then coalesce(v_item->'metadata','{}'::jsonb) else '{}'::jsonb end
    );
  end loop;

  insert into erp_supply.order_tasks(
    order_id,step_code,sequence_no,queue_code,status
  )
  select v_order_id,ws.code,1,ws.queue_code,'QUEUED'
  from erp_supply.workflow_steps ws
  where ws.code=v_initial_step
  returning id into v_task_id;

  insert into erp_supply.order_events(
    organization_id,order_id,task_id,event_type,action_code,
    to_step_code,to_status,actor_profile_id,actor_role_code,idempotency_key,payload
  )
  values(
    v_org,v_order_id,v_task_id,'ORDER_CREATED','CREATE',
    v_initial_step,'QUEUED',v_actor,(erp_private.current_roles())[1],
    nullif(trim(p_idempotency_key),''),
    jsonb_build_object('contractVersion','1.0.0')
  );

  return jsonb_build_object(
    'success',true,
    'idempotent',false,
    'orderId',v_order_id,
    'currentStep',v_initial_step,
    'status','QUEUED',
    'contractVersion','1.0.0'
  );
exception
  when unique_violation then
    raise exception 'Ya existe un pedido con el número %',v_order_number using errcode='23505';
  when invalid_text_representation then
    raise exception 'Uno de los campos numéricos, booleanos o de fecha tiene formato inválido' using errcode='22023';
end;
$$;

revoke all on function public.erp_x_session() from public, anon;
revoke all on function public.erp_x_list_orders(text,text,text,text,text,integer,integer,boolean) from public, anon;
revoke all on function public.erp_x_get_order(uuid) from public, anon;
revoke all on function public.erp_x_create_order(jsonb,text) from public, anon;

grant execute on function public.erp_x_session() to authenticated;
grant execute on function public.erp_x_list_orders(text,text,text,text,text,integer,integer,boolean) to authenticated;
grant execute on function public.erp_x_get_order(uuid) to authenticated;
grant execute on function public.erp_x_create_order(jsonb,text) to authenticated;

commit;

begin;

insert into erp_supply.modules(code,name,description,icon,sort_order,active) values
('assistant','PACO','Asistente operativo guiado y alertas','message-circle',180,true),
('audit','Auditoría','Eventos críticos y trazabilidad','scan-search',190,true),
('admin','Administración','Usuarios, roles, permisos y configuración','settings',200,true)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=true;

create table erp_supply.security_role_policies (
  role_code text primary key references erp_supply.roles(code) on delete cascade,
  require_mfa boolean not null default false,
  sensitive_admin boolean not null default false,
  updated_by uuid references erp_supply.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table erp_supply.admin_rate_windows (
  organization_id uuid not null references erp_supply.organizations(id) on delete cascade,
  profile_id uuid not null references erp_supply.profiles(id) on delete cascade,
  operation text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count>0),
  primary key (organization_id,profile_id,operation,window_start)
);

alter table erp_supply.security_role_policies enable row level security;
alter table erp_supply.admin_rate_windows enable row level security;
revoke all on erp_supply.admin_rate_windows from authenticated;

create or replace function erp_private.admin_rate_limit(
  p_operation text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $
declare
  v_org uuid:=erp_private.current_org_id();
  v_profile uuid:=erp_private.current_profile_id();
  v_window timestamptz;
  v_count integer;
begin
  if v_org is null or v_profile is null then
    raise exception 'Sesión administrativa inválida' using errcode='42501';
  end if;
  v_window:=to_timestamp(
    floor(extract(epoch from now())/p_window_seconds)*p_window_seconds
  );
  insert into erp_supply.admin_rate_windows(
    organization_id,profile_id,operation,window_start,request_count
  )
  values(v_org,v_profile,lower(btrim(p_operation)),v_window,1)
  on conflict (organization_id,profile_id,operation,window_start)
  do update set request_count=erp_supply.admin_rate_windows.request_count+1
  returning request_count into v_count;

  delete from erp_supply.admin_rate_windows
  where window_start<now()-interval '24 hours';

  return v_count<=p_limit;
end;
$;

revoke all on function erp_private.admin_rate_limit(text,integer,integer) from public,anon;
grant execute on function erp_private.admin_rate_limit(text,integer,integer) to authenticated;

create policy security_role_policies_read
on erp_supply.security_role_policies
for select to authenticated
using (
  role_code=any(erp_private.current_roles())
  or erp_private.can_access_module('admin','read')
);

grant select on erp_supply.security_role_policies to authenticated;
revoke insert,update,delete on erp_supply.security_role_policies from authenticated;

create or replace function erp_private.current_aal()
returns text
language sql
stable
security invoker
set search_path=pg_catalog
as $$
  select coalesce(auth.jwt()->>'aal','aal1')
$$;

create or replace function erp_private.require_admin_aal2()
returns void
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if not erp_private.can_access_module('admin','admin') then
    raise exception 'Administración sensible no autorizada' using errcode='42501';
  end if;
  if erp_private.current_aal()<>'aal2' then
    raise exception 'MFA requerido para esta operación' using errcode='42501';
  end if;
end;
$$;

revoke all on function erp_private.current_aal() from public,anon;
revoke all on function erp_private.require_admin_aal2() from public,anon;
grant execute on function erp_private.current_aal() to authenticated;
grant execute on function erp_private.require_admin_aal2() to authenticated;

create or replace function public.erp_x_admin_users(
  p_search text default null,
  p_active boolean default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_search text:=lower(nullif(btrim(coalesce(p_search,'')),''));
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(greatest(coalesce(p_page_size,50),1),100);
  v_total integer;
  v_items jsonb;
begin
  if v_org is null or not erp_private.can_access_module('admin','read') then
    raise exception 'No autorizado para consultar administración' using errcode='42501';
  end if;

  select count(*)::integer into v_total
  from erp_supply.profiles p
  where p.organization_id=v_org
    and not p.is_system
    and (p_active is null or p.active=p_active)
    and (
      v_search is null
      or lower(concat_ws(' ',p.email,p.display_name,coalesce(p.employee_code,''))) like '%'||v_search||'%'
    );

  select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb)
  into v_items
  from (
    select
      p.id,
      p.email,
      p.display_name name,
      p.employee_code "employeeCode",
      p.active,
      (p.auth_user_id is not null) "authLinked",
      p.created_at "createdAt",
      p.updated_at "updatedAt",
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'code',r.code,
          'name',r.name,
          'primary',pr.is_primary,
          'requireMfa',coalesce(srp.require_mfa,false)
        ) order by pr.is_primary desc,r.name)
        from erp_supply.profile_roles pr
        join erp_supply.roles r on r.code=pr.role_code
        left join erp_supply.security_role_policies srp on srp.role_code=r.code
        where pr.profile_id=p.id
      ),'[]'::jsonb) roles
    from erp_supply.profiles p
    where p.organization_id=v_org
      and not p.is_system
      and (p_active is null or p.active=p_active)
      and (
        v_search is null
        or lower(concat_ws(' ',p.email,p.display_name,coalesce(p.employee_code,''))) like '%'||v_search||'%'
      )
    order by p.display_name
    limit v_size offset (v_page-1)*v_size
  ) x;

  return jsonb_build_object(
    'items',v_items,
    'pagination',jsonb_build_object(
      'page',v_page,'pageSize',v_size,'totalItems',v_total,
      'totalPages',case when v_total=0 then 0 else ceil(v_total::numeric/v_size)::integer end
    ),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_roles()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
begin
  if not erp_private.can_access_module('admin','read') then
    raise exception 'No autorizado para consultar roles' using errcode='42501';
  end if;

  return jsonb_build_object(
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',r.code,
        'name',r.name,
        'description',r.description,
        'active',r.active,
        'systemRole',r.system_role,
        'requireMfa',coalesce(srp.require_mfa,false),
        'sensitiveAdmin',coalesce(srp.sensitive_admin,false),
        'permissions',coalesce((
          select jsonb_agg(jsonb_build_object(
            'module',m.code,
            'moduleName',m.name,
            'read',p.can_read,
            'create',p.can_create,
            'update',p.can_update,
            'approve',p.can_approve,
            'admin',p.can_admin
          ) order by m.sort_order,m.code)
          from erp_supply.modules m
          left join erp_supply.role_module_permissions p
            on p.role_code=r.code and p.module_code=m.code
          where m.active
        ),'[]'::jsonb)
      ) order by r.name)
      from erp_supply.roles r
      left join erp_supply.security_role_policies srp on srp.role_code=r.code
      where r.active
    ),'[]'::jsonb),
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_organization()
returns jsonb
language plpgsql
stable
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
begin
  if v_org is null or not erp_private.can_access_module('admin','read') then
    raise exception 'No autorizado para consultar organización' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'id',o.id,
      'code',o.code,
      'name',o.name,
      'timezone',o.timezone,
      'active',o.active,
      'settings',o.settings,
      'contractVersion','1.0.0'
    )
    from erp_supply.organizations o where o.id=v_org
  );
end;
$$;

create or replace function public.erp_x_admin_update_profile(
  p_profile_id uuid,
  p_display_name text,
  p_employee_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_before jsonb;
  v_name text:=btrim(coalesce(p_display_name,''));
begin
  perform erp_private.require_admin_aal2();
  if v_name='' or length(v_name)>160 then
    raise exception 'Nombre de perfil inválido' using errcode='22023';
  end if;

  select to_jsonb(p) into v_before
  from erp_supply.profiles p
  where p.id=p_profile_id and p.organization_id=v_org and not p.is_system
  for update;

  if v_before is null then
    raise exception 'Perfil no disponible' using errcode='P0002';
  end if;

  update erp_supply.profiles
  set display_name=v_name,
      employee_code=nullif(btrim(coalesce(p_employee_code,'')),''),
      updated_at=now()
  where id=p_profile_id and organization_id=v_org;

  perform erp_private.audit_event(
    'admin','USER_PROFILE_UPDATED','profile',p_profile_id::text,'SUCCESS',
    jsonb_build_object(
      'before',jsonb_build_object(
        'displayName',v_before->>'display_name',
        'employeeCode',v_before->>'employee_code'
      ),
      'after',jsonb_build_object(
        'displayName',v_name,
        'employeeCode',nullif(btrim(coalesce(p_employee_code,'')),'')
      )
    )
  );

  return jsonb_build_object('success',true,'profileId',p_profile_id,'contractVersion','1.0.0');
end;
$$;

create or replace function public.erp_x_admin_set_user_active(
  p_profile_id uuid,
  p_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_before boolean;
  v_reason text:=btrim(coalesce(p_reason,''));
begin
  perform erp_private.require_admin_aal2();
  if p_active is null or v_reason='' or length(v_reason)>500 then
    raise exception 'Estado o motivo inválido' using errcode='22023';
  end if;
  if p_profile_id=v_actor and not p_active then
    raise exception 'No puedes desactivar tu propio perfil administrativo' using errcode='22023';
  end if;

  select active into v_before
  from erp_supply.profiles
  where id=p_profile_id and organization_id=v_org and not is_system
  for update;

  if not found then
    raise exception 'Perfil no disponible' using errcode='P0002';
  end if;

  if v_before is distinct from p_active then
    if not p_active and exists(
      select 1 from erp_supply.profile_roles
      where profile_id=p_profile_id and role_code='super_admin'
    ) and not exists(
      select 1
      from erp_supply.profiles p
      join erp_supply.profile_roles pr on pr.profile_id=p.id and pr.role_code='super_admin'
      where p.organization_id=v_org and p.active and not p.is_system and p.id<>p_profile_id
    ) then
      raise exception 'Debe permanecer al menos un superadministrador activo' using errcode='22023';
    end if;

    update erp_supply.profiles
    set active=p_active,updated_at=now()
    where id=p_profile_id and organization_id=v_org;
  end if;

  perform erp_private.audit_event(
    'admin',case when p_active then 'USER_ACTIVATED' else 'USER_DEACTIVATED' end,
    'profile',p_profile_id::text,'SUCCESS',
    jsonb_build_object('from',v_before,'to',p_active,'reason',v_reason)
  );

  return jsonb_build_object(
    'success',true,'profileId',p_profile_id,'active',p_active,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_set_user_roles(
  p_profile_id uuid,
  p_roles text[],
  p_primary_role text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_roles text[];
  v_before text[];
  v_reason text:=btrim(coalesce(p_reason,''));
begin
  perform erp_private.require_admin_aal2();

  select coalesce(array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),array[]::text[])
  into v_roles from unnest(coalesce(p_roles,array[]::text[])) x
  where btrim(x)<>'';

  if cardinality(v_roles)=0 or p_primary_role is null
     or not lower(btrim(p_primary_role))=any(v_roles)
     or v_reason='' or length(v_reason)>500 then
    raise exception 'Roles, principal o motivo inválidos' using errcode='22023';
  end if;

  if exists(
    select 1 from unnest(v_roles) role_code
    where not exists(select 1 from erp_supply.roles r where r.code=role_code and r.active)
  ) then
    raise exception 'Existe un rol no válido o inactivo' using errcode='22023';
  end if;

  if not exists(
    select 1 from erp_supply.profiles p
    where p.id=p_profile_id and p.organization_id=v_org and p.active and not p.is_system
  ) then
    raise exception 'Perfil activo no disponible' using errcode='P0002';
  end if;

  select coalesce(array_agg(pr.role_code order by pr.role_code),array[]::text[])
  into v_before
  from erp_supply.profile_roles pr where pr.profile_id=p_profile_id;

  if 'super_admin'=any(v_before) and not ('super_admin'=any(v_roles))
     and not exists(
       select 1
       from erp_supply.profiles p
       join erp_supply.profile_roles pr on pr.profile_id=p.id and pr.role_code='super_admin'
       where p.organization_id=v_org and p.active and not p.is_system and p.id<>p_profile_id
     ) then
    raise exception 'Debe permanecer al menos un superadministrador activo' using errcode='22023';
  end if;

  delete from erp_supply.profile_roles
  where profile_id=p_profile_id and not (role_code=any(v_roles));

  insert into erp_supply.profile_roles(profile_id,role_code,is_primary,granted_by)
  select p_profile_id,r,(r=lower(btrim(p_primary_role))),v_actor
  from unnest(v_roles) r
  on conflict (profile_id,role_code) do update set
    is_primary=excluded.is_primary,
    granted_by=excluded.granted_by,
    granted_at=now();

  update erp_supply.profile_roles
  set is_primary=(role_code=lower(btrim(p_primary_role)))
  where profile_id=p_profile_id;

  perform erp_private.audit_event(
    'admin','USER_ROLES_CHANGED','profile',p_profile_id::text,'SUCCESS',
    jsonb_build_object('before',v_before,'after',v_roles,'primary',lower(btrim(p_primary_role)),'reason',v_reason)
  );

  return jsonb_build_object(
    'success',true,'profileId',p_profile_id,'roles',v_roles,
    'primaryRole',lower(btrim(p_primary_role)),'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_set_permission(
  p_role_code text,
  p_module_code text,
  p_capability text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_role text:=lower(btrim(coalesce(p_role_code,'')));
  v_module text:=lower(btrim(coalesce(p_module_code,'')));
  v_cap text:=lower(btrim(coalesce(p_capability,'')));
  v_reason text:=btrim(coalesce(p_reason,''));
  v_before boolean;
  v_sql text;
begin
  perform erp_private.require_admin_aal2();

  if v_role='' or v_module='' or v_cap not in('read','create','update','approve','admin')
     or p_enabled is null or v_reason='' or length(v_reason)>500 then
    raise exception 'Cambio de permiso inválido' using errcode='22023';
  end if;
  if v_role='super_admin' and not p_enabled then
    raise exception 'Los permisos de super_admin no pueden reducirse desde la UI' using errcode='22023';
  end if;
  if not exists(select 1 from erp_supply.roles where code=v_role and active)
     or not exists(select 1 from erp_supply.modules where code=v_module and active) then
    raise exception 'Rol o módulo no disponible' using errcode='P0002';
  end if;

  insert into erp_supply.role_module_permissions(
    role_code,module_code,can_read,can_create,can_update,can_approve,can_admin
  ) values(v_role,v_module,false,false,false,false,false)
  on conflict (role_code,module_code) do nothing;

  execute format(
    'select %I from erp_supply.role_module_permissions where role_code=$1 and module_code=$2',
    'can_'||v_cap
  ) into v_before using v_role,v_module;

  v_sql:=format(
    'update erp_supply.role_module_permissions set %I=$1 where role_code=$2 and module_code=$3',
    'can_'||v_cap
  );
  execute v_sql using p_enabled,v_role,v_module;

  perform erp_private.audit_event(
    'admin','PERMISSION_CHANGED','role_permission',v_role||':'||v_module,'SUCCESS',
    jsonb_build_object(
      'role',v_role,'module',v_module,'capability',v_cap,
      'from',v_before,'to',p_enabled,'reason',v_reason
    )
  );

  return jsonb_build_object(
    'success',true,'role',v_role,'module',v_module,'capability',v_cap,
    'enabled',p_enabled,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_update_organization(
  p_name text,
  p_timezone text,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_name text:=btrim(coalesce(p_name,''));
  v_timezone text:=btrim(coalesce(p_timezone,''));
  v_before jsonb;
begin
  perform erp_private.require_admin_aal2();
  if v_name='' or length(v_name)>200
     or not exists(select 1 from pg_timezone_names where name=v_timezone) then
    raise exception 'Nombre o zona horaria inválidos' using errcode='22023';
  end if;

  select jsonb_build_object('name',name,'timezone',timezone,'settings',settings)
  into v_before
  from erp_supply.organizations where id=v_org for update;

  update erp_supply.organizations
  set name=v_name,timezone=v_timezone,settings=coalesce(p_settings,'{}'::jsonb),updated_at=now()
  where id=v_org;

  perform erp_private.audit_event(
    'admin','ORGANIZATION_UPDATED','organization',v_org::text,'SUCCESS',
    jsonb_build_object(
      'before',v_before,
      'after',jsonb_build_object('name',v_name,'timezone',v_timezone,'settings',coalesce(p_settings,'{}'::jsonb))
    )
  );

  return public.erp_x_admin_organization();
end;
$$;

create or replace function public.erp_x_admin_password_reset_prepare(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_email text;
begin
  perform erp_private.require_admin_aal2();
  if not erp_private.admin_rate_limit('password_reset',5,600) then
    raise exception 'Demasiados restablecimientos solicitados; inténtalo más tarde' using errcode='22023';
  end if;

  select email into v_email
  from erp_supply.profiles
  where id=p_profile_id and organization_id=v_org and active and not is_system;

  if v_email is null then
    raise exception 'Perfil activo no disponible' using errcode='P0002';
  end if;

  perform erp_private.audit_event(
    'admin','PASSWORD_RESET_REQUESTED','profile',p_profile_id::text,'REQUESTED',
    jsonb_build_object('channel','SUPABASE_RECOVERY_EMAIL')
  );

  return jsonb_build_object(
    'profileId',p_profile_id,'email',v_email,'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_invite_prepare(
  p_email text,
  p_display_name text,
  p_employee_code text,
  p_roles text[],
  p_primary_role text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_org uuid:=erp_private.current_org_id();
  v_actor uuid:=erp_private.current_profile_id();
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_name text:=btrim(coalesce(p_display_name,''));
  v_roles text[];
  v_primary text:=lower(btrim(coalesce(p_primary_role,'')));
begin
  perform erp_private.require_admin_aal2();
  if not erp_private.admin_rate_limit('user_invite',5,600) then
    raise exception 'Demasiadas invitaciones solicitadas; inténtalo más tarde' using errcode='22023';
  end if;

  select coalesce(array_agg(distinct lower(btrim(x)) order by lower(btrim(x))),array[]::text[])
  into v_roles from unnest(coalesce(p_roles,array[]::text[])) x where btrim(x)<>'';

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or v_name='' or length(v_name)>160 or cardinality(v_roles)=0
     or not v_primary=any(v_roles) then
    raise exception 'Datos de invitación inválidos' using errcode='22023';
  end if;

  if exists(
    select 1 from unnest(v_roles) r
    where not exists(select 1 from erp_supply.roles rr where rr.code=r and rr.active)
  ) then
    raise exception 'Rol de invitación inválido' using errcode='22023';
  end if;

  if exists(
    select 1 from erp_supply.profiles p
    where p.organization_id=v_org and lower(p.email)=v_email
  ) then
    raise exception 'Ya existe un perfil con ese correo' using errcode='23505';
  end if;

  perform erp_private.audit_event(
    'admin','USER_INVITE_REQUESTED','profile',v_email,'REQUESTED',
    jsonb_build_object('roles',v_roles,'primaryRole',v_primary)
  );

  return jsonb_build_object(
    'organizationId',v_org,
    'actorProfileId',v_actor,
    'email',v_email,
    'displayName',v_name,
    'employeeCode',nullif(btrim(coalesce(p_employee_code,'')),''),
    'roles',to_jsonb(v_roles),
    'primaryRole',v_primary,
    'contractVersion','1.0.0'
  );
end;
$$;

create or replace function public.erp_x_admin_invite_finalize(
  p_organization_id uuid,
  p_actor_profile_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_employee_code text,
  p_roles text[],
  p_primary_role text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_profile uuid;
begin
  if not exists(
    select 1
    from erp_supply.profiles actor
    join erp_supply.profile_roles pr on pr.profile_id=actor.id
    join erp_supply.role_module_permissions mp
      on mp.role_code=pr.role_code and mp.module_code='admin' and mp.can_admin
    where actor.id=p_actor_profile_id
      and actor.organization_id=p_organization_id
      and actor.active and not actor.is_system
  ) then
    raise exception 'Actor administrativo inválido' using errcode='42501';
  end if;

  insert into erp_supply.profiles(
    organization_id,auth_user_id,email,display_name,employee_code,active,is_system
  )
  values(
    p_organization_id,p_auth_user_id,lower(btrim(p_email)),btrim(p_display_name),
    nullif(btrim(coalesce(p_employee_code,'')),''),true,false
  )
  returning id into v_profile;

  insert into erp_supply.profile_roles(profile_id,role_code,is_primary,granted_by)
  select v_profile,r,(r=lower(btrim(p_primary_role))),p_actor_profile_id
  from unnest(p_roles) r;

  insert into erp_supply.audit_events(
    organization_id,actor_profile_id,actor_kind,module_code,action,
    resource_type,resource_id,result,metadata
  )
  values(
    p_organization_id,p_actor_profile_id,'USER','admin','USER_INVITED',
    'profile',v_profile::text,'SUCCESS',
    jsonb_build_object('email',lower(btrim(p_email)),'roles',p_roles)
  );

  return jsonb_build_object(
    'success',true,'profileId',v_profile,'contractVersion','1.0.0'
  );
end;
$$;

revoke all on function public.erp_x_admin_users(text,boolean,integer,integer) from public,anon;
revoke all on function public.erp_x_admin_roles() from public,anon;
revoke all on function public.erp_x_admin_organization() from public,anon;
revoke all on function public.erp_x_admin_update_profile(uuid,text,text) from public,anon;
revoke all on function public.erp_x_admin_set_user_active(uuid,boolean,text) from public,anon;
revoke all on function public.erp_x_admin_set_user_roles(uuid,text[],text,text) from public,anon;
revoke all on function public.erp_x_admin_set_permission(text,text,text,boolean,text) from public,anon;
revoke all on function public.erp_x_admin_update_organization(text,text,jsonb) from public,anon;
revoke all on function public.erp_x_admin_password_reset_prepare(uuid) from public,anon;
revoke all on function public.erp_x_admin_invite_prepare(text,text,text,text[],text) from public,anon;
revoke all on function public.erp_x_admin_invite_finalize(
  uuid,uuid,uuid,text,text,text,text[],text
) from public,anon,authenticated;

grant execute on function public.erp_x_admin_users(text,boolean,integer,integer) to authenticated;
grant execute on function public.erp_x_admin_roles() to authenticated;
grant execute on function public.erp_x_admin_organization() to authenticated;
grant execute on function public.erp_x_admin_update_profile(uuid,text,text) to authenticated;
grant execute on function public.erp_x_admin_set_user_active(uuid,boolean,text) to authenticated;
grant execute on function public.erp_x_admin_set_user_roles(uuid,text[],text,text) to authenticated;
grant execute on function public.erp_x_admin_set_permission(text,text,text,boolean,text) to authenticated;
grant execute on function public.erp_x_admin_update_organization(text,text,jsonb) to authenticated;
grant execute on function public.erp_x_admin_password_reset_prepare(uuid) to authenticated;
grant execute on function public.erp_x_admin_invite_prepare(text,text,text,text[],text) to authenticated;
grant execute on function public.erp_x_admin_invite_finalize(
  uuid,uuid,uuid,text,text,text,text[],text
) to service_role;

commit;

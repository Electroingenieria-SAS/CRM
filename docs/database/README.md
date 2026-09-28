# Base de datos

## Estado de origen auditado

- PostgreSQL 17 en Supabase.
- 77 tablas base en `erp_supply`; todas con RLS habilitado.
- 28 tablas base en `public`; todas con RLS habilitado.
- 170 RPC públicas con prefijo `erp_x_*`.
- 162 de esas RPC usan SECURITY DEFINER.
- 0 RPC `erp_x_*` ejecutables por `anon` en el corte inicial.
- 14 roles de negocio, 20 módulos y 133 relaciones de permiso módulo/rol.
- 6 tablas `public` publicadas a Supabase Realtime.
- 0 buckets Supabase Storage.
- El ledger fuente reconoce 27 cambios históricos que existen solo en la base productiva, por lo que el instalador legado no se considera baseline confiable.

## Baseline limpio del CRM nuevo

La reconstrucción no copia el instalador monolítico del CRM fuente. Se construye en migraciones pequeñas y ordenadas:

1. `20260928000100_core_identity_rbac.sql`: organización, perfiles, roles, módulos, permisos y helpers privados.
2. `20260928000200_order_catalogs.sql`: catálogos y workflow.
3. `20260928000300_orders_core.sql`: pedidos, líneas, tareas, eventos, integridad, índices y RLS.
4. `20260928000400_orders_api.sql`: RPC públicas `SECURITY INVOKER`.

El esquema `erp_supply` es interno y no está incluido en `api.schemas`. `erp_private` contiene únicamente helpers privilegiados que necesitan resolver identidad/RBAC atravesando RLS; todos tienen `search_path` explícito, grants mínimos y no están expuestos como API pública.

## Gate reproducible

CI debe reconstruir una base vacía con:

```text
supabase start
supabase db reset
supabase test db
supabase db lint --level error
```

Los tests usan usuarios y organizaciones sintéticos. No usan dumps, tokens ni PII productiva.

## Regla de promoción

Una tabla/RPC del CRM fuente solo se migra cuando su dominio está siendo reconstruido. Antes de producción debe tener integridad, permisos, RLS, tests positivos/negativos, documentación y paridad funcional.

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

## Estrategia del CRM nuevo

1. Conservar compatibilidad solo para el módulo que se esté migrando.
2. Inventariar cada RPC usada por ese módulo.
3. Revisar autorización, concurrencia, idempotencia, `search_path` y grants.
4. Reducir SECURITY DEFINER donde no sea necesario.
5. Versionar todo DDL bajo `supabase/migrations/`.
6. Probar permitido y prohibido antes de conectar el frontend nuevo.

Las recomendaciones de índices no se aplican automáticamente: requieren evidencia de plan, cardinalidad y frecuencia de uso.

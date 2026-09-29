# Vercel Preview — CRM nuevo

## Proyecto

Crear un proyecto Vercel **separado** para `Electroingenieria-SAS/CRM`.

No reutilizar `crm-suministros`, porque corresponde al producto antiguo y debe permanecer disponible durante la validación.

## Variables Preview

Configurar únicamente en el entorno **Preview**:

- `NEXT_PUBLIC_APP_ENV=preview`
- `NEXT_PUBLIC_APP_VERSION=<SHA o release candidate>`
- `NEXT_PUBLIC_SUPABASE_URL=<entorno QA/no productivo>`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key QA>`

Nunca configurar en variables `NEXT_PUBLIC_*`:

- service_role;
- secret key;
- JWT secret;
- database password;
- tokens de administración.

La Edge Function `admin-users` usa secretos gestionados por Supabase, no por el navegador. Su `APP_ALLOWED_ORIGINS` debe incluir únicamente el hostname Preview aprobado y, después, el hostname productivo.

## Smoke Preview

Antes de producción:

1. login/logout;
2. sesión y permisos;
3. listado y detalle de pedidos;
4. Admin lectura;
5. MFA enrollment/challenge en cuenta QA;
6. Auditoría;
7. PACO resumen, alerta y cancelar consulta;
8. navegación móvil/tablet/desktop;
9. headers CSP/HSTS/noindex;
10. PWA manifest + actualización de service worker;
11. `erp_x_release_health()` sin errores críticos nuevos.

## Promoción

No asociar dominio productivo hasta que CI esté verde, el preview esté validado y exista rollback. La promoción del frontend no sustituye migraciones/Edge Functions: cada capa debe tener su propio release y rollback.

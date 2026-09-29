# Runbook — Auth y administración

## Incidente de login

1. Verificar estado Supabase Auth y variables públicas del entorno.
2. Comprobar que el usuario tenga perfil CRM activo y `auth_user_id` enlazado.
3. No leer, pedir ni recuperar contraseñas actuales.
4. Usar recuperación de Supabase o el inicio de reset desde Admin.
5. Para operaciones administrativas sensibles, verificar que la sesión alcance `aal2`.

## MFA

`super_admin` y roles sensibles configurados usan TOTP. La mutación administrativa se protege en PostgreSQL; esconder botones en UI no sustituye la comprobación AAL2.

Si MFA falla, no desactivar el control para “resolver” el incidente. Recuperar el factor mediante el proceso autorizado de Supabase y dejar trazabilidad.

## Cuenta comprometida

Desactivar perfil CRM, revocar/invalidar sesiones desde el mecanismo de Auth disponible, revisar Auditoría y restaurar acceso solo después de completar recuperación segura.

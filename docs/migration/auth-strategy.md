# Hilo 15 — Estrategia de migración de Auth

Referencia vigente de Supabase: la migración entre proyectos puede incluir el esquema `auth`, incluidos hashes de contraseña; los tokens existentes dependen del JWT secret del proyecto. El proyecto nuevo tendrá su propio contexto de seguridad salvo decisión operativa explícita.

## Decisión

- Mantener IDs UUID v4 cuando el mecanismo soportado lo permita.
- Migrar usuarios mediante export/import soportado o dump lógico del esquema Auth dentro del procedimiento oficial.
- No extraer ni documentar contraseñas en texto plano.
- No copiar secretos MFA manualmente.
- Por defecto, asumir que sesiones/tokens existentes se invalidan y los usuarios deben autenticarse de nuevo después del cutover.
- No reutilizar el JWT secret legado solo para evitar re-login: aumenta acoplamiento y riesgo de claves históricas.
- Verificar `auth.users`, `auth.identities`, perfiles y roles después del restore/import.
- Superadmins/administradores con política MFA deben validar enrolamiento/reauthentication en el smoke de migración.

## Validación

El snapshot actual tiene 32 usuarios Auth activos y 33 perfiles; la diferencia debe clasificarse (perfil de sistema/sin Auth) durante el dry-run, no corregirse a ciegas.

El preflight ya confirmó que todo `profiles.auth_user_id` no nulo apunta a un usuario Auth existente.

# Workforce · seguridad, RLS y evidencias

## Matriz funcional

| Actor                       | Leer cronograma | Crear propia       | Planificar equipo | Autoasignar | Ejecutar propia | Configurar exclusiones |
| --------------------------- | --------------- | ------------------ | ----------------- | ----------- | --------------- | ---------------------- |
| Rol operativo con Workforce | Sí              | Sí                 | No                | No          | Sí              | No                     |
| Líder/Jefatura/Gerencia     | Sí              | Sí                 | Sí                | Sí          | Sí/gestión      | Sí                     |
| Superadmin                  | Sí              | Sí                 | Sí                | Sí          | Sí/gestión      | Sí                     |
| Auditoría                   | Sí              | Sí según RBAC base | No                | No          | Propia          | No                     |
| Otra organización           | No              | No                 | No                | No          | No              | No                     |
| anon                        | No              | No                 | No                | No          | No              | No                     |

La autorización efectiva se resuelve mediante `role_module_permissions`; no hay `if role === ...` disperso en React.

## RLS

Todas las tablas Workforce tienen RLS.

Principios:

- lectura limitada a la organización actual;
- todas las actividades de la organización son visibles independientemente de quién las creó;
- responsables modifican lo permitido sobre su propia actividad;
- planificación de equipo requiere capacidad de gestión;
- referencias de catálogo/pedido/tarea se revalidan contra la organización para evitar BOLA;
- el ledger de eventos no concede UPDATE ni DELETE.

## Evidencia

Bucket local/de staging:

`workforce-evidence`

Características:

- privado;
- límite 15 MB;
- PNG/JPEG/WebP/PDF;
- ruta prefijada por organización;
- RLS por prefijo de organización;
- frontend valida tamaño;
- infraestructura valida MIME y firma mágica;
- PostgreSQL conserva solo referencia y metadata;
- foto final/BFORE-AFTER se verifica nuevamente en backend al cerrar.

El cierre normal no requiere aprobación de jefatura.

## Tratamiento especial

La excepción histórica se reconstruye como configuración:

`workforce_profile_policies.profile_id`

Puede excluir un perfil de:

- métricas de ocupación;
- métricas de tiempo.

El perfil sigue apareciendo en Día/Semana/Mes y en historial.

No se utiliza nombre, correo ni texto visible como clave de negocio.

## Pruebas

pgTAP certifica:

- calendario y festivos;
- permisos RPC;
- SECURITY INVOKER;
- append-only;
- aislamiento multi-organización;
- planificación en jornada;
- rechazo de lunch/weekend/holiday;
- conflictos;
- idempotencia;
- inicio/cierre;
- evidencia requerida;
- cierre sin aprobación;
- tratamiento especial.

Una prueba de integración usa dos sesiones simultáneas para certificar un solo inicio y un solo cierre.

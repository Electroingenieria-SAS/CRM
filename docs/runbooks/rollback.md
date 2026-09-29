# Runbook — Rollback

## Frontend / Vercel

1. Identificar el deployment saludable anterior y su SHA.
2. Confirmar si el incidente es solo frontend o incluye DB/Edge Functions.
3. Promover el deployment saludable anterior sin cambiar dominio hasta completar smoke.
4. Validar login, sesión, pedidos, permisos, Admin/Auditoría y el flujo afectado.
5. Revisar `erp_x_release_health()`, logs y correlation ids.

## Base de datos

Una migración aplicada no se “deshace” automáticamente con revert de Git.

Antes de DDL productivo debe existir una de estas rutas:

- migración backward-compatible seguida de forward-fix;
- migración de compensación explícita;
- restore desde backup verificado cuando exista pérdida/corrupción y la ventana esté autorizada.

Nunca ejecutar rollback destructivo sin backup reciente y validación en no producción.

## Edge Functions

1. Conservar fuente/configuración versionada por release.
2. Si una Function nueva falla, volver a desplegar la versión anterior conocida.
3. Verificar JWT/CORS y variables antes de reactivar tráfico.
4. No copiar secretos desde logs ni repositorio.
5. Las Functions legacy no se modifican durante el rollback del CRM nuevo salvo evidencia de que causan el incidente.

## Service worker / PWA

El service worker usa cache versionado solo para estáticos. Una nueva versión elimina caches CRM anteriores en `activate`. Si una release PWA causa problemas, revertir frontend y publicar un nuevo `CACHE_VERSION`; no reutilizar una versión rota.

## Cierre

Registrar release afectada, causa, acciones, datos impactados, resultado del smoke y decisión de forward-fix o rollback.

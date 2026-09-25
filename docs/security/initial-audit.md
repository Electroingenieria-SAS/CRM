# Auditoría de seguridad inicial

## Hallazgos verificados

1. El repositorio fuente no expone ejecución anónima de RPC `erp_x_*` en el estado auditado.
2. `erp_supply` no concede DML directo a `anon` o `authenticated`; el navegador opera mediante RPC.
3. Las 162 funciones `erp_x_*` SECURITY DEFINER observadas tienen `search_path` explícito, pero la cantidad sigue siendo demasiado alta para aceptar el patrón sin auditoría por caso de uso.
4. Supabase Security Advisor mantiene Leaked Password Protection deshabilitado.
5. La Edge Function productiva `erp-auditoria-metrics` no coincide con el contrato versionado: está desplegada sin JWT, con CORS wildcard y elevación interna a service role.
6. La Edge Function `erp-auditoria-bridge` también usa `verify_jwt=false`, pero su código sí implementa dos rutas de autenticación explícitas (sesión de usuario y claim server-to-server); no debe equipararse al caso de métricas.
7. El último CI del CRM fuente pasó escaneo histórico y TruffleHog, pero el E2E autenticado se omitió por ausencia de secretos QA.

## Política para la reconstrucción

El nuevo CRM no se conectará a producción mientras SEC-001, SEC-002 y SEC-004 no tengan una resolución o compensación aprobada y probada. No se realizarán cambios destructivos desde la fase de auditoría.

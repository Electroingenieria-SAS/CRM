# Runbook — Deploy y promoción

## Preview

1. La rama/PR debe pasar typecheck, lint, format, arquitectura, unit, DB/RLS, security, secret scan, dependency/CodeQL, E2E crítico, a11y y build.
2. Desplegar la rama en **Vercel Preview** con variables de preview, nunca con producción como QA.
3. Ejecutar smoke no destructivo: login, sesión, pedidos lectura/creación sintética si aplica, permisos, Admin lectura, Auditoría lectura y PACO resumen.
4. Revisar `erp_x_release_health()` y logs de Vercel/Supabase.
5. Confirmar CSP/headers y manifest/service worker.

## Producción

Promover únicamente con:

- PR sincronizado con `main`;
- P0 sin blocker;
- rollback documentado;
- backup reciente verificado;
- variables productivas presentes;
- reglas de protección de `main` activas;
- Edge Functions necesarias desplegadas con configuración versionada.

No cambiar dominio productivo ni retirar la aplicación antigua antes de smoke final y ventana de rollback.

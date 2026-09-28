# Auditoría de seguridad inicial

Corte verificado: 2026-09-25.

## Hallazgos verificados

1. El repositorio fuente no expone ejecución anónima de RPC `erp_x_*` en el estado auditado: 170 RPC observadas, 0 ejecutables por `anon`.
2. `erp_supply` no concede DML directo a `anon` o `authenticated`; el navegador opera mediante RPC.
3. De 170 RPC `erp_x_*`, 162 son `SECURITY DEFINER`, 160 son ejecutables por `authenticated` y 152 combinan ambas condiciones. Las 162 `SECURITY DEFINER` auditadas tienen `search_path` explícito.
4. Solo 4 tablas de `erp_supply` tienen políticas RLS explícitas; el resto combina RLS habilitado sin políticas con revocación de DML directo. Esto es compatible con el patrón RPC-only actual, pero debe certificarse por caso de uso.
5. Supabase Security Advisor mantiene Leaked Password Protection deshabilitado.
6. La Edge Function productiva `erp-auditoria-metrics` está desplegada con `verify_jwt=false`, CORS `*` y un cliente interno `service_role`. Su salida se declara agregada, pero el endpoint continúa siendo una superficie privilegiada pública hasta demostrar que el RPC solo retorna información aprobada para exposición.
7. `erp-auditoria-bridge` también usa `verify_jwt=false`, pero implementa autenticación propia: JWT de usuario + autorización RPC para navegador, y claim de entrega server-to-server para despachos de base de datos. Debe mantenerse fuera del nuevo CRM hasta tener pruebas negativas y positivas automatizadas.
8. Realtime publica seis tablas del esquema `public` y ninguna de `erp_supply`.
9. Supabase Storage no tiene buckets configurados; la evidencia documental permanece en integraciones externas/Drive.
10. El ledger productivo contiene dos migraciones con el mismo nombre `freight_predictive_model_v11_40_0` bajo versiones diferentes; debe reconciliarse antes de construir un baseline de recuperación.
11. El último pipeline del nuevo CRM en `main` (SHA `1f56c54d8501bcc3d862bfd995788e4f69baf127`) terminó correctamente antes de abrir este bloque de cambios.
12. El repositorio nuevo no tiene ruleset de protección para `main`; los controles de CI todavía pueden omitirse mediante push directo.

## Política para la reconstrucción

El nuevo CRM no se conectará a producción mientras los P0 de autenticación, recuperación, autorización y superficies privilegiadas no tengan pruebas positivas/negativas y evidencia. No se realizarán cambios destructivos de base de datos durante esta fase.

## Controles incorporados en la rama P0

- RBAC dinámico por `recurso.acción`, sin reemplazar los 14 roles reales por una lista ficticia de seis roles.
- Contrato de autenticación desacoplado de UI.
- Adaptador Supabase para login, logout, recuperación y cambio de contraseña.
- CSP, HSTS, `nosniff`, Referrer Policy, Permissions Policy y anti-indexación para ejecución Next/Vercel.
- E2E preparado para Chromium, Firefox, WebKit, Android, iPhone y tablet.
- Resoluciones de referencia: 320, 375, 390, 430, 768, 1024, 1366 y 1920 px.

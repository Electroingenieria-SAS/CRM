# Certificación técnica — Hilo 12

Fecha de corte: 2026-09-29  
Rama: `reconstruction/p1-admin-audit-assistant-release`  
PR: #19

## A. Administración

Estado: implementado, pendiente de evidencia final CI.

- usuarios/perfiles;
- activar/desactivar;
- roles reales y rol principal;
- permisos por capacidad;
- organización;
- invitación segura server-side;
- reset seguro;
- último superadmin protegido;
- mutaciones sensibles con AAL2.

## B. Auditoría

Estado: implementado, pendiente de evidencia final CI.

- ledger append-only;
- actor/organización/acción/recurso/resultado/request id;
- metadata mínima y rechazo de secretos;
- eventos sensibles de Admin, Finance, Inventory, Orders y PACO;
- visor filtrable con paginación backend.

## C. PACO

Estado: implementado, pendiente de evidencia final CI.

- mensajería flotante;
- español tolerante a errores comunes;
- consulta de pedido/cola/ocupación/resumen;
- navegación;
- wizard de actividad;
- cancelar consulta;
- alertas de demora e inactividad;
- cooldown/dedupe/ack;
- voz progresiva + fallback texto;
- RBAC heredado de servicios existentes;
- auditoría de acciones mediante PACO.

## D. Seguridad final

Estado: implementación del CRM nuevo completada; blockers externos documentados.

- CSP/HSTS/nosniff/referrer/permissions/frame/noindex presentes;
- CORS allowlist en nueva Edge Function Admin;
- JWT obligatorio en función Admin;
- rate limit PACO/Admin;
- service_role solo server-side;
- secret scans/CodeQL/supply-chain como gates;
- Leaked Password Protection: no disponible en Free, requiere decisión externa;
- legacy `erp-auditoria-metrics`: pendiente fuera del repo nuevo;
- ruleset GitHub: pendiente manual.

## E. Observabilidad

Estado: implementado.

- logger estructurado único;
- correlation id;
- sanitización de PII/secrets;
- telemetría WARN/ERROR persistente y rate-limited;
- `erp_x_release_health()`;
- errores, warnings, importaciones y outbox Orders→Workforce;
- error boundaries recuperables;
- runbook de alertas.

## F. PWA / resiliencia

Estado: implementado.

- manifest;
- iconos;
- service worker versionado;
- actualización segura;
- fallback offline;
- cache limitado a estáticos;
- no cache de navegación/datos privados.

## G. Backup / restore / runbooks

Estado: procedimiento implementado; restore real externo pendiente.

- dump lógico Free;
- checksums;
- restore explícitamente no productivo;
- deploy/rollback/Auth/PACO/imports/incidentes/observabilidad;
- CI reconstruye DB desde migraciones/seed;
- restore de dump productivo real requiere destino no productivo aprobado.

## H. Release / Vercel

Estado: parcialmente bloqueado por infraestructura externa.

- pipeline de release existente;
- rollback documentado;
- variables Preview documentadas;
- cuenta Vercel solo tiene proyecto legacy `crm-suministros`;
- no se reutiliza producción antigua como QA;
- crear proyecto Vercel nuevo antes del cutover.

## I. Certificación final

La certificación solo cambia a **Validado** cuando el head del PR tenga verdes:

- Quality/security/build;
- DB reset + pgTAP/RLS + lint;
- E2E staging;
- E2E autenticado Admin/Audit/PACO;
- accessibility release;
- secret scan;
- CodeQL;
- supply-chain.

## Estado de promoción

**No promover a producción** hasta resolver/aceptar formalmente los blockers de `docs/release/final-readiness.md`.

Un CI verde certificará el software de esta rama; no elimina por sí solo dependencias externas de plan, governance, preview y restore.

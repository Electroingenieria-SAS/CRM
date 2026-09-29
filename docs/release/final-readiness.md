# Release readiness — Hilo 12

Corte técnico: 2026-09-29.

## Implementado en esta rama

- Administración modular de usuarios, perfiles, roles, permisos y organización.
- MFA TOTP para administración sensible; mutaciones administrativas protegidas por AAL2.
- Invitación server-side mediante Supabase Auth; ninguna contraseña se almacena o recupera.
- Reset seguro por correo de recuperación con trazabilidad de actor/usuario.
- Auditoría append-only paginada y filtrable, con metadata sanitizada.
- PACO operativo sobre Orders/Workforce/Analytics existentes, con wizard de actividad, alertas, dedupe, cooldown, acknowledge, rate limit, texto y voz con fallback.
- Telemetría separada de Auditoría, sanitizada y rate-limited.
- Error boundaries recuperables.
- PWA limitada: instalación, estáticos versionados y fallback offline; no cachea datos privados.
- Backup lógico Free + restore protegido a no-producción.
- Runbooks de deploy, rollback, Auth, PACO, imports, incidentes, observabilidad y recuperación.

## Gates requeridos

La release no se certifica solo por código. El PR debe completar:

- `npm run validate`;
- performance budget;
- `supabase db reset` desde vacío;
- pgTAP/RLS;
- DB lint;
- E2E staging;
- E2E autenticado, incluido Admin/Audit/PACO;
- secret scan;
- CodeQL;
- `npm audit --audit-level=high`;
- build.

## Blockers externos para promoción productiva

### B1 — Legacy `erp-auditoria-metrics`

Sigue desplegada con `verify_jwt=false`, CORS `*` y cliente service_role. El CRM nuevo no la consume. El hilo está limitado al repositorio `CRM`, por lo que el cierre exige una ventana coordinada sobre el legado o su retiro comprobado.

### B2 — Leaked Password Protection

La organización Supabase está en Free. La documentación oficial de Supabase indica que Leaked Password Protection está disponible en Pro+. Se implementaron controles compensatorios —MFA administrativo, rate limits, reset seguro, Auth nativo— pero la aceptación del riesgo o upgrade de plan es una decisión operativa externa.

### B3 — Protección de `main`

El repositorio no tiene ruleset. La integración GitHub disponible permite comprobarlo pero no escribir rulesets/branch protection. Debe activarse manualmente con PR obligatorio, checks requeridos y force-push bloqueado.

### B4 — Vercel Preview del CRM nuevo

La cuenta Vercel solo expone el proyecto legacy `crm-suministros`; el conector disponible no permite crear un proyecto nuevo. No se reutiliza producción antigua como QA. Crear un proyecto separado para `Electroingenieria-SAS/CRM`, configurar variables Preview y ejecutar smoke antes de promoción.

### B5 — Restore de dump real

El plan Free no ofrece un entorno hospedado no-productivo de restore en este hilo. El procedimiento y scripts están preparados, y CI reconstruye la base desde migraciones/seed. Antes del cutover debe ejecutarse un restore de un dump reciente en un destino no productivo aprobado o habilitar un plan/entorno que lo permita.

## Regla de promoción

El PR puede quedar técnicamente verde y mergeable por calidad de código. La **promoción productiva** permanece bloqueada mientras B1–B5 no estén resueltos o formalmente aceptados por el responsable del release según corresponda.

# Deuda técnica y pendientes de release

## Blockers de cutover

| ID | Tema | Estado | Cierre requerido |
| --- | --- | --- | --- |
| B1 | Edge Function legacy `erp-auditoria-metrics` pública/privilegiada | Externo al repo nuevo | Hardening o retiro coordinado con consumidores |
| B2 | Leaked Password Protection | Limitación plan Free | Upgrade Pro+ o aceptación formal del riesgo compensado |
| B3 | Ruleset de `main` | Configuración manual | PR obligatorio + checks + no force push |
| B4 | Proyecto Vercel nuevo / Preview | No existe | Crear proyecto separado y validar Preview |
| B5 | Restore de dump reciente | No ejecutado | Restore smoke en destino no productivo |

## Post-release permitido

- Instrumentar más operaciones con `durationMs` si las métricas muestran latencia real.
- Integrar un log drain externo si el volumen justifica retención/alertamiento dedicado.
- Ampliar PACO con nuevas intenciones solo cuando existan contratos de aplicación estables.

## Mejoras futuras, no deuda

- Voz server-side dedicada.
- CRM completamente offline.
- PITR.
- Automatización de backup hacia un proveedor concreto aún no seleccionado.

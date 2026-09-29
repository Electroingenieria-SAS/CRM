# Runbook — PACO

PACO consume Orders, Workforce y Analytics; no mantiene lógica de negocio paralela.

## Fallos de consulta

- Si voz falla, continuar por texto.
- Si Analytics/Workforce no está disponible, PACO debe informar la limitación y no inventar datos.
- Revisar `erp_x_release_health()`, telemetría y permisos `assistant.*`.

## Alertas

Las alertas usan persistencia, deduplicación, cooldown y acknowledge. No crear timers permanentes de frontend ni notificar cada minuto. Inactividad se configura por rol, nunca por nombre de persona.

## Acción sensible

Toda acción debe respetar el mismo RBAC que la UI. Las acciones sensibles requieren confirmación y quedan auditadas con `channel=PACO`.

## Wizard atascado

Usar **Cancelar consulta**. Debe limpiar el estado del wizard sin alterar ninguna actividad ya confirmada.

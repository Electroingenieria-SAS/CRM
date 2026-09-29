# Runbook — Incidentes

## Severidad

- P0: pérdida/alteración de datos, bypass de autorización, secreto expuesto, Auth general caído.
- P1: flujo crítico indisponible sin pérdida de datos.
- P2: degradación localizada con workaround.

## Respuesta

1. Identificar correlation/request id y release SHA.
2. Consultar `erp_x_release_health()`, Auditoría y telemetría.
3. Contener: deshabilitar integración/feature afectada o revertir frontend si procede.
4. No ejecutar DDL destructivo ni restaurar producción sin backup y autorización.
5. Aplicar forward-fix cuando una migración ya modificó datos y revertir commit no sea suficiente.
6. Registrar causa, impacto, corrección y verificación.

## Alertas mínimas

Investigar cuando ocurra cualquiera:

- errores repetidos de la misma operación;
- `orderWorkforce.failed > 0`;
- `orderWorkforce.staleProcessing > 0`;
- importaciones `FAILED`;
- aumento sostenido de errores de Auth o PACO;
- despliegue con regresión de E2E/build.

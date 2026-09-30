# Hilo 6 · Orders → Workforce

Corte: 2026-09-28.

## Checkpoints

| Checkpoint                      | Estado           | Evidencia                                                      |
| ------------------------------- | ---------------- | -------------------------------------------------------------- |
| A · inspección Orders/Workforce | Validado         | Orders PR #8 + Workforce PR #11 fusionados en `main`           |
| B · contratos/eventos           | Implementado     | eventos v1.0.0 + ports de integración                          |
| C · persistencia/idempotencia   | Implementado     | outbox transaccional, dedupe, binding y retry                  |
| D · claim/start/complete        | Implementado     | adapter real sobre `WorkforceService` + readiness de cierre    |
| E · block/reassign/recovery     | Implementado     | lifecycle real, reasignación por segmentos y reconciliación    |
| F · ocupación/indicadores       | Implementado     | calendario Workforce + business seconds + políticas por perfil |
| G · UI mínima                   | Implementado     | health, ocupación, pedidos, tiempos y reconciliación           |
| H · tests                       | Validado         | unit, integración, concurrencia, pgTAP/RLS y E2E real          |
| I · CI + merge                  | Validado         | PR #12 fusionado; CI pre/post-merge y deploy de Pages verdes    |

## Reglas certificadas por diseño

- responsable = persona que tomó/recibió el paso operativo;
- vendedor se conserva por referencia y no se convierte en responsable;
- no polling;
- no snapshots completos del pedido en Workforce;
- idempotencia de evento y actividad separadas;
- doble click/retry no duplica actividad;
- reasignación activa conserva el tramo de A y abre continuación para B;
- bloqueo no equivale a finalización;
- `COMPLETE` de Orders respeta la evidencia exigida por Workforce;
- jornada/festivos no se vuelven a implementar en Orders;
- exclusiones especiales se resuelven por `workforce_profile_policies`, no por nombres;
- la regla de >1 hora utiliza la señal de Workforce;
- no se genera ranking humano simplista.

## Indicadores integrados

El snapshot agregado contiene actividades activas, bloqueadas y finalizadas; personas ocupadas/disponibles; pedidos por etapa; promedio de minutos productivos por actividad/etapa; actividad por responsable; responsable y vendedor por pedido; tiempo bloqueado; inactividad laboral y exclusiones configuradas.

El tiempo productivo no se calcula como `completed_at - created_at`: utiliza segundos laborales y resta intervalos bloqueados.

## PACO y VSM

PACO no se implementa en este hilo. Quedan disponibles `occupancy`, `inactivityMinutes`, pedido/actividad actual y estado bloqueado para un consumidor posterior.

VSM tampoco se completa aquí. Orders + Workforce conservan referencias, eventos, tiempo productivo y tiempo bloqueado suficientes para calcular posteriormente lead time, waiting time y productive time.

## Producción

Este hilo no modifica Supabase/Auth/datos productivos. Toda validación se ejecuta con Supabase local y fixtures sintéticos.

## Evidencia de cierre

- PR #12 fusionado en `main`.
- SHA pre-merge validado: `cb82ac7cdd39d795c0ae6a1a6c3b2c074c0cd16c`.
- Merge commit: `9f17a394338fb7daf916a3dc70ee9a2efc5e2a14`.
- Pipeline general post-merge `36573624856`: quality, database/pgTAP/RLS/DB lint, CodeQL, secret scan, supply-chain, E2E staging, E2E autenticado y deploy Pages verdes.
- Pipeline Workforce post-merge `36573624593`: quality, database y E2E desktop/iPhone/Android verdes.

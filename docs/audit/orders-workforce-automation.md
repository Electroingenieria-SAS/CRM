# Hilo 6 · Orders → Workforce

Corte: 2026-09-28.

## Checkpoints

| Checkpoint                      | Estado                 | Evidencia                                                        |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| A · inspección Orders/Workforce | Validado               | Orders PR #8 en main; Workforce PR #11 abierto y no copiado      |
| B · contratos/eventos           | Implementado           | eventos v1.0.0 + ports de integración                            |
| C · persistencia/idempotencia   | Implementado           | outbox transaccional, dedupe, binding y retry                    |
| D · claim/start/complete        | Implementado en bridge | captura durable; adapter Workforce pendiente del merge de PR #11 |
| E · block/reassign/recovery     | Implementado en bridge | eventos, locks recuperables y reconciliación                     |
| F · ocupación/indicadores       | Contrato preparado     | ocupación real pertenece a Workforce PR #11                      |
| G · UI mínima                   | Implementado           | panel de salud/reconciliación; no suplanta ocupación             |
| H · tests                       | En validación CI       | unit, lifecycle sintético, pgTAP, RLS, concurrencia y E2E        |
| I · CI + merge                  | Pendiente              | solo se fusionará verde y sincronizado con main                  |

## Métricas que este hilo no falsifica

Orders no calcula por sí solo:

- disponibilidad humana;
- minutos laborales activos;
- tiempo bloqueado laboral;
- inactividad;
- exclusiones especiales;
- festivos;
- almuerzo;
- ocupación histórica.

Esas métricas se consumen desde Workforce, que es dueño del calendario y de las actividades.

## Preparación para PACO y VSM

Los contratos de indicadores incluyen inactivityMinutes, estado de ocupación, tiempo activo/bloqueado y exclusiones configuradas. El bridge conserva los eventos y referencias necesarias para VSM, pero no calcula lead time/productividad en este hilo.

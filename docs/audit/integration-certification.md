# Certificación de integración global — Hilo 13

Estado inicial: **en validación CI**  
Baseline: `main@88fdd5d40b35d555c0c83e6ce02732f799de6861`

## Propósito

Este bloque no reconstruye dominios. Certifica que los módulos ya fusionados conservan contratos compatibles cuando se ejecutan juntos sobre una única base Supabase reconstruida desde cero.

## Contratos críticos

| Integración                             | Contrato / evidencia                                                             | Gate                          |
| --------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| Auth → RBAC/RLS                         | sesión operativa + permisos por organización                                     | authenticated E2E + pgTAP     |
| Customer Intelligence → Orders          | `erp_x_customer_priority_signal` aplicada antes de insertar pedidos autenticados | pgTAP 004 + Orders E2E        |
| Orders → Finance                        | lectura de gate financiero desde detalle de pedido                               | Orders/Finance E2E            |
| Orders → Workforce                      | outbox, lifecycle, evidencia y reconciliación                                    | concurrency + integration E2E |
| Receiving/Picking/Cutting → Inventory   | ports de integración, reservas y movimientos                                     | Supply/Inventory tests        |
| Finance → Billing                       | Finance conserva factura/pago como fuente de verdad                              | Billing/Logistics E2E         |
| Freight → Logistics                     | estimación separada de costo real; realimentación del costo observado            | Logistics E2E                 |
| Logistics → Orders                      | entrega completa el ciclo operativo mediante port de Orders                      | Logistics E2E                 |
| Analytics → operación                   | read models de Orders/Workforce/Logistics sin bypass de RLS                      | Analytics pgTAP + E2E         |
| Admin/Audit/PACO → servicios existentes | PACO orquesta servicios y auditoría conserva acciones críticas                   | release E2E                   |

## Estrategia de regresión

El job `e2e-authenticated` levanta una sola instancia Supabase local, reconstruye todas las migraciones, carga fixtures sintéticos compartidos y ejecuta:

1. pruebas de concurrencia críticas;
2. recorrido desktop Chromium de todos los dominios;
3. smoke móvil dirigido para Customer Intelligence, Workforce y Logistics;
4. seguridad, CodeQL y secret scanning en jobs independientes.

No se duplica la auditoría de cada dominio ni se consulta producción.

## Criterio de cierre

Hilo 13 queda validado únicamente cuando:

- `supabase db reset` y pgTAP estén verdes;
- el full-domain authenticated regression esté verde;
- el smoke móvil esté verde;
- quality/architecture/build estén verdes;
- CodeQL, TruffleHog y dependency audit estén verdes;
- no quede una incompatibilidad transversal abierta.

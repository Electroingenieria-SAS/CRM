# ADR-0005 · Orders → Workforce mediante outbox transaccional

Fecha: 2026-09-28  
Estado: Aceptado

## Contexto

Orders ya persiste su workflow y publica eventos tipados en `order_events.payload.integrationEvent`. Workforce está siendo reconstruido en una rama independiente y es dueño de actividades, jornada, ocupación, evidencias y calendario laboral.

Una llamada directa desde infraestructura de Orders a infraestructura de Workforce crearía acoplamiento circular. El polling continuo además incrementaría llamadas y no es apropiado para el plan Free.

## Decisión

Se usa un outbox pequeño y específico creado en la misma transacción que `order_events` mediante trigger interno.

- Orders continúa siendo dueño del estado del pedido.
- Workforce continúa siendo dueño de la actividad y la ocupación.
- El outbox guarda referencias, nunca snapshots completos del pedido.
- `order_event_id` y `dedupe_key` garantizan idempotencia.
- claim del outbox es atómico y soporta recuperación de locks obsoletos.
- fallos permanecen visibles como `FAILED`; no se pierden silenciosamente.
- reconciliación es explícita y no corre en cada render.
- no existe polling periódico.

El procesador de Application depende de `WorkforceAutomationPort`. Mientras Workforce no esté fusionado, CI usa un fake tipado; después del merge se conectará el adapter real sin cambiar Orders.

## Consistencia

El alta del evento de integración es atómica con el evento de Orders. La aplicación de ese evento en Workforce es eventualmente consistente y recuperable. Esta decisión evita introducir un servicio de mensajería pago.

Una finalización que requiera evidencia seguirá perteneciendo a Workforce. Hasta que el dominio Workforce se fusione y exponga el gate de evidencia, este PR no declara cerrada la consistencia de `COMPLETE` punta a punta.

## Eventos

`OrderTaskClaimed`, `OrderTaskAssigned`, `OrderTaskStarted`, `OrderBlocked`, `OrderTaskResumed`, `OrderTaskCompleted`, `OrderCancelled` y `ReconcileOrderTask`.

## Etapas auditadas

Integradas: ALISTAMIENTO, CORTE, LOCAL_DISPATCH, NATIONAL_DISPATCH, CLIENT_POINT y CLIENT_PICKUP.

El CRM fuente auditado no tiene `PRODUCCION` como paso separado; por eso no se inventa esa integración. Cartera, Caja, Compras y Facturación tampoco se convierten en actividades operativas en este bridge.

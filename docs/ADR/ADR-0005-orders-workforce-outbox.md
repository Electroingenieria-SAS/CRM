# ADR-0005 · Orders → Workforce mediante outbox transaccional

Fecha: 2026-09-28  
Estado: Aceptado

## Contexto

Orders persiste su workflow y publica eventos tipados en `order_events.payload.integrationEvent`. Workforce, fusionado en `main` mediante PR #11, es dueño de actividades, jornada, ocupación, evidencias, calendario laboral y políticas especiales por perfil.

Una llamada `orders infrastructure → workforce infrastructure` crearía acoplamiento circular. El polling periódico además aumentaría llamadas sin aportar consistencia y no es apropiado para el plan Free.

## Decisión

Se utiliza un outbox específico creado en la misma transacción que `order_events`.

- Orders continúa siendo dueño del estado del pedido.
- Workforce continúa siendo dueño de actividad, jornada, ocupación y evidencia.
- El outbox conserva referencias y payload mínimo, no snapshots completos del pedido.
- `order_event_id` y `organization_id + dedupe_key` garantizan idempotencia de captura.
- `activityKey` identifica establemente la actividad de una `order_task`.
- `eventKey` identifica cada mutación CLAIM/START/BLOCK/RESUME/ASSIGN/COMPLETE/CANCEL.
- El claim del outbox es atómico y recupera locks `PROCESSING` obsoletos.
- Los fallos permanecen visibles como `FAILED`; la reconciliación es explícita.
- No existe polling periódico.

El adapter real implementa `WorkforceAutomationPort` y usa `WorkforceService` para start, block, resume, complete y cancel. Dos RPC de integración cubren creación automática y reasignación activa sin duplicar reglas de Workforce.

## Reasignación

Una reasignación de una actividad `PLANNED` utiliza la asignación normal de Workforce.

Si la actividad está `IN_PROGRESS` o `BLOCKED`, no se sobrescribe simplemente A → B. El tramo de A queda cerrado con trazabilidad y se crea una continuación para B vinculada al mismo `order_task_id`. Esto evita atribuir a B el tiempo ejecutado por A.

## Consistencia y evidencia

El evento de integración se hace durable de forma atómica con Orders. La aplicación de ese evento a Workforce es recuperable mediante outbox.

Para `COMPLETE` existe una excepción deliberada: antes de comprometer la finalización de Orders, Application consulta `erp_x_order_workforce_completion_readiness`. Si la etapa está integrada y no existe actividad Workforce, la actividad no está en curso o falta la evidencia definida por Workforce, Orders no completa la etapa.

Después del commit de Orders, el observer procesa el evento `OrderTaskCompleted` y cierra la actividad Workforce. Un fallo posterior queda en outbox y es reconciliable.

## Tiempo laboral

La creación automática obtiene una ventana válida a partir de los segmentos y festivos persistidos por Workforce. Los indicadores usan `workforce_business_seconds`, restan tiempo bloqueado y respetan las exclusiones configuradas en `workforce_profile_policies`.

## Eventos

`OrderTaskClaimed`, `OrderTaskAssigned`, `OrderTaskStarted`, `OrderBlocked`, `OrderTaskResumed`, `OrderTaskCompleted`, `OrderCancelled` y `ReconcileOrderTask`.

## Etapas auditadas

Integradas: ALISTAMIENTO, CORTE, LOCAL_DISPATCH, NATIONAL_DISPATCH, CLIENT_POINT y CLIENT_PICKUP.

El workflow fuente auditado no tiene `PRODUCCION` como paso separado; no se inventa esa integración. Cartera, Caja, Compras y Facturación tampoco se convierten en actividades operativas de Workforce.

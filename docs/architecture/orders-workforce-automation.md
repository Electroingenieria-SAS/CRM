# Integración Orders → Workforce

Fecha: 2026-09-28.

## Límites

Orders es dueño de workflow, tareas, estados e historial del pedido. Workforce es dueño de actividades, jornada, calendario, ocupación, evidencias y políticas especiales.

```text
OrderWorkflowService
        ↓ commit Orders
order_events
        ↓ misma transacción
order_workforce_outbox
        ↓ observer / Application
OrdersWorkforceAutomationService
        ↓ port
SupabaseWorkforceAutomationAdapter
        ↓
WorkforceService + RPC de integración
        ↓
workforce_activities / events / evidence
```

No existe importación infraestructura→infraestructura entre dominios. La composición se realiza en `src/composition/browser-application.ts`.

## Ciclo de vida

- CLAIM: crea una actividad `ORDER_EVENT` y vincula `order_id + order_task_id`.
- ASSIGN: reasigna PLANNED o divide el tramo activo A→B conservando historia.
- START: inicia la misma actividad vinculada.
- BLOCK: inicia primero si fuera necesario y registra bloqueo en Workforce.
- RESUME: reanuda sin perder el tramo bloqueado.
- COMPLETE: valida readiness/evidencia antes de cerrar Orders y después completa Workforce.
- CANCEL: cancela la actividad no finalizada.
- RECONCILE: alinea una tarea activa faltante sin ejecutarse en cada render.

## Idempotencia y concurrencia

- captura: `order_event_id` único;
- outbox: `organization_id + dedupe_key` único;
- actividad: `orders-workforce:<order_task_id>:activity`;
- mutación: `orders-workforce:event:<order_event_id>`;
- claim atómico `PENDING/FAILED → PROCESSING`;
- locks obsoletos recuperables;
- eventos Workforce con idempotency key única;
- pruebas concurrentes verifican un único ganador.

## Jornada y ocupación

El bridge no implementa su propio calendario. Consume las reglas Workforce:

- 07:00–12:00;
- 13:40–17:30;
- sábados y domingos excluidos;
- festivos persistidos;
- políticas de exclusión por `profile_id`.

El indicador integrado distingue AVAILABLE, OCCUPIED, BLOCKED y OUT_OF_SCHEDULE. La inactividad se expresa en minutos laborales cuando existe un último fin de actividad.

## Indicadores

Una RPC agregada entrega:

- actividades activas/finalizadas/bloqueadas;
- personas ocupadas/disponibles;
- pedidos en operación y por etapa;
- promedio por actividad y por etapa;
- tiempo productivo y bloqueado;
- actividad por responsable;
- pedido, etapa, responsable y vendedor;
- inactividad disponible para PACO;
- datos de tiempo preparados para VSM.

No se generan rankings de “mejor” o “peor” persona.

## Vendedor y responsable

El vendedor se conserva como referencia del pedido. El responsable Workforce es quien tomó o recibió la tarea operativa; nunca se sustituye uno por el otro.

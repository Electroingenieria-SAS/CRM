# Integración Orders → Workforce

Fecha: 2026-09-28.

## Límites

Orders es dueño de workflow, tareas, estados e historial del pedido. Workforce es dueño de actividades, jornada, calendario, ocupación, evidencias y políticas especiales.

El bridge vive en `modules/integrations/orders-workforce` y no importa infraestructura de ninguno de los dos dominios.

```text
Orders RPC / order_events
        ↓ misma transacción
order_workforce_outbox
        ↓ Application port
OrdersWorkforceAutomationService
        ↓
WorkforceAutomationPort
        ↓
Workforce Application (cuando su rama se fusione)
```

## No polling

El outbox no se consulta por intervalo. La aplicación lo procesa después de una mutación de Orders o mediante una reconciliación explícita. Los fallos quedan persistidos para reparación posterior.

## Idempotencia

- captura: `order_event_id` único;
- deduplicación: `organization_id + dedupe_key`;
- actividad: clave estable `orders-workforce:<order_task_id>`;
- claim: cambio condicional `PENDING/FAILED → PROCESSING`;
- ACK duplicado de una fila ya procesada retorna resultado idempotente.

## Concurrencia

Dos consumidores no pueden reclamar simultáneamente el mismo outbox. El primero actualiza la fila; el segundo recibe conflicto. Locks `PROCESSING` de más de cinco minutos son recuperables.

## Reasignación

`OrderTaskAssigned` conserva el evento anterior y entrega el nuevo `assigneeProfileId`. Workforce debe cerrar/trazar la responsabilidad anterior y continuar con la nueva; nunca se sustituye historia.

## Bloqueo y reanudación

`OrderBlocked` y `OrderTaskResumed` se conservan como eventos distintos. El bridge no calcula duración laboral: Workforce usa su calendario, festivos y segmentos 07:00–12:00 / 13:40–17:30.

## Vendedor

`sellerProfileId` viaja como referencia de contexto. No se convierte en responsable de la actividad.

## Producción

La auditoría del CRM fuente no encontró `PRODUCCION` como paso separado del workflow vigente. No se inventa un mapping. Si un hilo futuro introduce un paso canónico, se agrega al catálogo de mappings.

## Consistencia y evidencia

El outbox hace durable la intención de sincronización, pero la evidencia de cierre pertenece a Workforce. Mientras Workforce no esté fusionado, este hilo no afirma consistencia punta a punta para `COMPLETE`; el fallo queda visible y reconciliable.

# Contrato Orders / Workforce · v1.0.0

## Eventos aceptados

- OrderTaskClaimed
- OrderTaskAssigned
- OrderTaskStarted
- OrderBlocked
- OrderTaskResumed
- OrderTaskCompleted
- OrderCancelled
- ReconcileOrderTask

## Payload mínimo

`orderId`, `orderTaskId`, `stepCode`, `workforceCatalogCode`, `assigneeProfileId`, `sellerProfileId`, `occurredAt`, `contractVersion`.

No se copian cliente, dirección, materiales, valor del pedido ni snapshot completo.

## Steps operativos mapeados

| Orders step       | Workforce catalog   |
| ----------------- | ------------------- |
| ALISTAMIENTO      | LOG_SUPPORT_PICKING |
| CORTE             | LOG_SUPPORT_CUTTING |
| LOCAL_DISPATCH    | LOG_LOADING         |
| NATIONAL_DISPATCH | LOG_LOADING         |
| CLIENT_POINT      | LOG_LOADING         |
| CLIENT_PICKUP     | LOG_LOADING         |

Los mappings se persisten en DB y pueden evolucionar sin hardcodear roles en frontend.

## Fallos

`FAILED` conserva error resumido y siguiente ventana de reintento. Reconciliación detecta eventos ausentes, fallidos o locks obsoletos; no se ejecuta en render.

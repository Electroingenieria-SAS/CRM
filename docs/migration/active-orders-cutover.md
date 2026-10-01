# Hilo 15 — Estado de pedidos en vuelo

Snapshot: 2026-09-30.

El corte productivo tiene actualmente **1 pedido activo**.

Estado agregado:

- etapa actual: `LOCAL_DISPATCH` — 1;
- tareas del pedido activo: 4;
- facturas asociadas: 1;
- reservas asociadas: 1 en estado `CONSUMED`;
- entregas registradas: 0.

## Regla de cutover

Este pedido debe reconciliarse individualmente después del freeze:

1. mismo `order_id`;
2. misma etapa y estado;
3. mismo responsable/rol vigente;
4. mismas tareas operativas relevantes;
5. misma factura;
6. reserva/consumo de inventario coherente;
7. logística sin inventar una entrega que aún no existe.

Cualquier diferencia en este pedido activo es **NO-GO** aunque los conteos globales coincidan.

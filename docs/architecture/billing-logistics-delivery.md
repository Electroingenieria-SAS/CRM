# Facturación, logística, entrega y satisfacción

## Alcance

Este bloque reconstruye el tramo final del pedido sin duplicar dominios existentes:

- **Finance** sigue siendo fuente de verdad de facturas y valor pagado.
- **Orders** sigue siendo dueño del workflow y del cierre global.
- **Freight Intelligence** sigue siendo dueño de estimación y aprendizaje.
- **Logistics** es dueño del shipment, guía, costo real, intentos, entrega y satisfacción.
- **Inventory** ya está fusionado en `main`. Su contrato actual no expone una operación específica de salida por despacho ni devolución logística; `LogisticsInventoryPort` queda como boundary explícito sin adapter hasta que Inventory publique ese contrato, evitando escrituras directas o semántica inventada.
- **Workforce** continúa recibiendo lifecycle por el contrato Orders ↔ Workforce existente.

## Flujo

1. Pedido llega a `FACTURACION` o `CAJA_FACTURACION`.
2. Para PVC/PVN/PVE se exige factura registrada en Finance; PVP exige `PVP_ANNEX` en `order_evidence`.
3. `erp_x_billing_readiness` combina documento, gate financiero e incidencias bloqueantes.
4. Orders completa Facturación y enruta a `CLIENT_POINT`, `CLIENT_PICKUP`, `LOCAL_DISPATCH` o `NATIONAL_DISPATCH`.
5. `erp_x_logistics_release` crea un único shipment `READY`.
6. LOCAL/NATIONAL pasan por `IN_TRANSIT`; NATIONAL exige transportadora y guía.
7. CLIENT_POINT/CLIENT_PICKUP pueden confirmar entrega desde `READY` con evidencia.
8. Entrega exitosa registra intento `DELIVERED` y luego Orders completa la etapa de ruta.
9. Fallo registra intento y `DELIVERY_FAILED`; puede reprogramarse a `READY`.
10. Retorno registra `RETURNED` y emite el resultado hacia el port de Inventory.
11. Satisfacción 1–5 es posterior y no bloquea el cierre.

## Estados e invariantes

`READY → IN_TRANSIT → DELIVERED` para despachos.

`READY → DELIVERED` para entrega en punto/retiro.

`READY|IN_TRANSIT → DELIVERY_FAILED → READY` para reintento.

`IN_TRANSIT|DELIVERY_FAILED → RETURNED` para devolución.

PostgreSQL impone:

- un shipment por organización/pedido;
- costo estimado/real >= 0;
- tracking único por organización + transportadora;
- `delivered_at >= dispatched_at` cuando existe despacho;
- idempotency key única en eventos;
- un número de intento por shipment;
- rating entre 1 y 5.

## Idempotencia y concurrencia

Release, guía, despacho, costo real, entrega, fallo, reprogramación y retorno usan idempotency keys, advisory locks, `FOR UPDATE` y versión optimista donde cambia estado.

Una guía ya registrada no puede sobrescribirse con otra clave. Los tests concurrentes certifican un solo ganador para guía, despacho y entrega.

## Freight

`estimated_freight`, rango y `prediction_id` nunca se sobrescriben con el costo final.

`actual_freight` pertenece a Logistics. Después de registrarlo, Application llama `FreightService.recordActual`. Si Freight falla, el despacho permanece válido y `freight_sync_status` queda `FAILED`; no hay rollback del despacho ni polling.

## Evidencia

Los binarios no se almacenan en tablas de dominio. Se usa el bucket privado `order-finalization-evidence`: máximo 15 MB, JPEG/PNG/WebP/PDF, validación de firma, path por organización/pedido/tipo y RLS de Storage.

`order_evidence` conserva únicamente la referencia.

## RBAC y segregación

- Caja puede registrar facturas.
- Coordinador Logístico puede validar/liberar la etapa de Facturación pero no emitir facturas.
- Roles logísticos autorizados pueden liberar, despachar y entregar.
- Jefatura/autoridad Freight puede corregir costo real.
- Ventas y Auditoría tienen lectura; Auditoría no muta.
- `super_admin` conserva administración, pero las RPC siguen aplicando reglas de negocio.

Todas las RPC logísticas públicas usan `SECURITY INVOKER + RLS`.

## Lecturas y rendimiento

`erp_x_billing_queue`, `erp_x_logistics_candidates`, `erp_x_logistics_queue` y `erp_x_logistics_detail` entregan lecturas agregadas/paginadas. La UI no hace una consulta por pedido/usuario y no usa polling.

## Inventory

Hilo 10 define `onDispatched(orderId, key)` y `onReturned(orderId, reason, key)` como ports de Application. Inventory ya está en `main`, pero su contrato publicado cubre recepción, reserva, picking, consumo/corte, devoluciones reutilizables y trazabilidad, no una salida/devolución logística. Por ello estos ports permanecen sin adapter y Logistics no escribe tablas de Inventory directamente.

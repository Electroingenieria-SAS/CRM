# ADR-0006 — Ownership del cierre comercial y logístico

Fecha: 2026-09-29

Estado: Aceptado

## Contexto

Facturación, fletes, despacho y cierre del pedido cruzan varios dominios. Copiar facturas, costos o estados entre tablas produciría dobles fuentes de verdad y acoplamiento.

## Decisión

- Finance conserva facturas y valor pagado.
- Logistics conserva shipment, guía, costo real, intentos, entrega y satisfacción.
- Freight conserva predicción, histórico y aprendizaje; recibe `actual_freight` como observación.
- Orders conserva workflow y cierre global; Logistics solo consume sus ports.
- Evidencias finales se almacenan fuera de las tablas de dominio y se referencian desde `order_evidence`.
- Inventory se integra por port y nunca mediante escritura directa desde Logistics.

## Consistencia

Las mutaciones logísticas son transaccionales dentro de PostgreSQL para su propio aggregate. Los efectos hacia Orders/Freight/Inventory se ejecutan por Application ports con idempotency keys derivadas.

Una falla de aprendizaje Freight no revierte un despacho ya válido; se registra `freight_sync_status=FAILED` para recuperación explícita. Una entrega registrada puede reintentar el avance de Orders sin duplicar la entrega.

## Consecuencias

- No existe una segunda tabla de facturas.
- Estimado y costo real permanecen separados.
- El cierre global continúa bajo Orders.
- Se evita polling entre dominios.
- La integración Inventory puede completarse al fusionarse su contrato sin migrar las tablas de Logistics.

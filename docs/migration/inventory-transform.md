# Hilo 15 — Contrato de transformación de inventario legacy → CRM nuevo

Este documento fija la equivalencia semántica usada por el dry-run. No autoriza escrituras productivas.

## Fuente legacy

En el legado, por lote:

- `quantity_available`: existencia físicamente disponible según Siesa antes de la reserva ERP;
- `quantity_reserved`: compromiso externo/Siesa;
- `quantity_blocked`: existencia no utilizable;
- reserva ERP: vive separada en `material_reservations`.

El propio legado calcula existencia física como:

`quantity_available + quantity_reserved + quantity_blocked`

y available-to-promise como disponibilidad menos reservas ERP activas.

## Destino nuevo

El modelo nuevo usa:

- `inventory_balances.on_hand`;
- `inventory_balances.reserved`;
- `inventory_balances.committed`.

Transformación:

- `on_hand = legacy available + legacy reserved + legacy blocked`;
- `committed = legacy quantity_reserved + quantity_blocked`;
- `reserved = reserva ERP activa efectivamente cubierta`;
- `available = on_hand - reserved - committed`.

Esto preserva el available-to-promise sin contar dos veces las reservas.

## Apertura

Los saldos iniciales se cargan como opening balances trazables en una ubicación normalizada. No se inventan movimientos históricos para explicar un saldo que el legado no puede reconstruir con certeza.

Las reservas ERP activas se reproducen después del opening balance con operaciones idempotentes del dominio nuevo. Si aparece `shortage_quantity > 0` en una reserva activa durante el freeze, el cutover queda en NO-GO hasta resolverla.

## Históricos

- Movimientos legacy confiables pueden conservarse como histórico/auditoría.
- No se recalcula el saldo final sumando ciegamente movimientos históricos si no son ledger completo.
- Reservas CONSUMED/RELEASED se conservan solo cuando aportan trazabilidad; no vuelven a reservar stock.
- Conteos y métricas derivadas se recalculan en el destino cuando corresponda.

## Reconciliación

El GO exige equivalencia, con tolerancia numérica mínima, de:

- físico total;
- committed total;
- reserva ERP efectiva;
- available-to-promise;
- reservas activas;
- pedidos activos y su inventario asociado.

El baseline definitivo se captura después del freeze.

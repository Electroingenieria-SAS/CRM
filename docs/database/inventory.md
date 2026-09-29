# Inventario

## Modelo

El dominio se organiza alrededor del maestro de materiales del CRM nuevo, variantes explícitas y ubicaciones operativas. Un saldo existe por combinación organización + material + variante + ubicación.

inventory_balances conserva:

- on_hand: existencia física;
- reserved: cantidad reservada para pedidos;
- committed: cantidad ya tomada por Picking o Corte;
- available: derivado como on_hand - reserved - committed.

No existe una operación pública para escribir un valor absoluto de stock.

## Movimientos

Toda alteración confirmada deja un registro en inventory_movements. Los movimientos no se actualizan ni eliminan; los errores elegibles se corrigen mediante reverso y el resto mediante el flujo operativo correspondiente.

El ledger incluye material, variante, ubicación, pedido, reserva, actor, fecha, referencia, motivo y deltas de físico, reservado y comprometido.

## Reservas y picking

Una reserva puede distribuirse entre varias ubicaciones. La selección se bloquea transaccionalmente y no admite reserva parcial silenciosa: si la cantidad completa no cabe, toda la operación revierte.

PICK transforma reservado en comprometido sin reducir todavía la existencia física. Posteriormente la cantidad comprometida se reparte entre consumo, sobrante reutilizable y desperdicio.

## Recepción y devoluciones

Receiving integra mediante ReceivingInventoryPort y registra RECEIPT idempotente. Una devolución operativa de material tomado libera el compromiso y lo vuelve disponible; no se borra el movimiento previo.

## Conteos

El conteo es ciego para operadores sin capacidad approve. Al enviarlo se guarda el snapshot teórico, pero ese valor no se expone al operador durante la captura. Un controlador decide aprobar, pedir reconteo o rechazar.

Si el saldo cambió entre captura y revisión, la aprobación no aplica un ajuste obsoleto y pasa a RECOUNT_REQUIRED.

## Integraciones

- Receiving: entrada idempotente.
- Picking: reserva, liberación y pick.
- Cutting: consumo, sobrante reutilizable y desperdicio.
- Orders: trazabilidad por pedido y disponibilidad.
- Purchasing: disponibilidad para decisiones de abastecimiento.

Los ports están en src/modules/inventory/ports. Los adapters Supabase están en src/infrastructure/inventory.

## Seguridad y aislamiento

RLS limita lecturas a la organización de la sesión. Las tablas internas no conceden INSERT, UPDATE ni DELETE directo a usuarios autenticados. Los RPC de mutación verifican capacidad e identidad y mantienen search_path explícito.

Auditoría tiene lectura; ajustes, reversos y aprobación de conteos requieren inventory.approve bajo el modelo actual de capacidades de módulo.

## Rendimiento

Las listas son paginadas. Los índices cubren consultas por material, pedido, reserva, estado y tiempo. La UI no descarga el inventario completo ni calcula saldos recorriendo el ledger.

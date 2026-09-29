# ADR-0006 · Inventario transaccional: ledger inmutable + saldo materializado

## Estado

Aceptado para la reconstrucción P1 de Inventario.

## Contexto

Inventario debe responder qué existe, dónde está, qué parte está reservada o comprometida y por qué el saldo llegó a su valor actual. Una columna de stock editable no preserva esa explicación y una proyección calculada recorriendo todo el historial en cada consulta es innecesariamente costosa para la operación diaria.

El CRM fuente ya diferenciaba existencia física, reserva ERP, variantes, ubicaciones y conteo ciego. La reconstrucción conserva esos conceptos sin copiar el acoplamiento del legado.

## Decisión

Se adopta una combinación de ledger confirmado e inmutable, saldo materializado por ubicación, reservas por pedido, asignaciones físicas, frontera de idempotencia y conteo físico ciego.

El balance mantiene on_hand, reserved y committed. La disponibilidad se deriva como:

available = on_hand - reserved - committed.

PostgreSQL exige que ningún componente sea negativo y que on_hand sea mayor o igual que reserved + committed.

## Semántica operativa

- RECEIPT aumenta físico.
- RESERVE aumenta reservado.
- RELEASE libera reservado.
- PICK traslada reservado a comprometido.
- CONSUME reduce físico y comprometido.
- RETURN libera material comprometido que vuelve a estar disponible.
- WASTE reduce físico y comprometido como desperdicio.
- ADJUSTMENT_IN y ADJUSTMENT_OUT son ajustes controlados y justificados.
- REVERSAL corrige entradas o ajustes elegibles sin borrar historia.

Para Corte, una cantidad tomada puede resolverse entre consumo, sobrante reutilizable y desperdicio; el reparto se registra antes de cerrar la reserva.

## Concurrencia e idempotencia

Las mutaciones bloquean el saldo o la reserva correspondiente con FOR UPDATE. La reserva distribuye únicamente disponibilidad actual y aborta toda la transacción si no logra cubrir la cantidad completa.

Cada comando crítico tiene una operation_key única por organización. Un retry con la misma clave devuelve el resultado ya confirmado en lugar de duplicar movimientos.

## Seguridad

Las tablas internas no conceden DML directo a authenticated. Lecturas usan RLS por organización. Las mutaciones pasan por RPC estrechos con capacidades del módulo inventory.

Mapeo vigente:

- read: saldos, movimientos, reservas y conteos;
- create: recepción, reserva y envío de conteo;
- update: release, picking, consumo, devolución y desperdicio;
- approve: ajuste, reverso y revisión de conteos;
- admin: reservado para administración futura del catálogo.

Auditoría conserva lectura sin mutación.

## Integraciones

Inventory expone ports pequeños para Receiving, Picking, Cutting, Orders y Purchasing. Ningún dominio externo escribe tablas internas. Orders y Purchasing disponen de un contrato estrecho de disponibilidad y los dominios operativos ejecutan comandos idempotentes.

## Consecuencias

La lectura de stock es económica y paginada; la explicación del saldo permanece disponible en el ledger. El costo es mantener ledger y proyección dentro de la misma transacción, requisito asumido deliberadamente para evitar divergencia.

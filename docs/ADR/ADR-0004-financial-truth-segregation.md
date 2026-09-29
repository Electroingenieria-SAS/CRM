# ADR-0004 · Fuente monetaria, segregación e idempotencia financiera

Fecha: 2026-09-28  
Estado: Aceptado

## Contexto

El CRM anterior mezcló a lo largo del tiempo decisiones financieras, referencias de pago y montos. Una migración posterior del legado llegó a priorizar `financial_validations.amount` para el cálculo de pago y usar la factura como respaldo.

La definición vigente del negocio para la reconstrucción es más estricta: **la factura registrada representa cuánto fue efectivamente pagado**.

Además, la auditoría no encontró una fuente persistente suficiente para reconstruir un cupo reutilizable ni días de mora calculados automáticamente.

## Decisión 1 · Fuente de verdad monetaria

El valor pagado se deriva exclusivamente del ledger de `erp_supply.invoices`:

- REGISTERED = amount;
- PARTIALLY_REVERSED = amount - reversed_amount;
- REVERSED = 0;
- VOID = 0.

`financial_validations` no tiene campo monetario.

Customer Intelligence consume una proyección mínima, no las tablas internas.

## Decisión 2 · No inventar cupo ni mora

No se crea una cuenta de crédito permanente ni `available_credit` calculado hasta que exista una política y fuente auditable.

No se calculan días de mora sin vencimientos persistentes verificables.

La ausencia de fuente se expresa explícitamente en el contrato, en vez de estimarse.

## Decisión 3 · Segregación

Solicitante y decisor de una excepción financiera deben ser personas distintas.

La restricción aplica también a `super_admin`.

Auditoría es lectura únicamente.

## Decisión 4 · Idempotencia y concurrencia

Las mutaciones financieras críticas combinan:

- clave idempotente;
- índice único;
- advisory transaction lock;
- row lock cuando existe un agregado previo.

El objetivo es que un retry concurrente no duplique dinero ni decisiones.

## Decisión 5 · Contrato con Orders

Orders sigue siendo dueño del workflow y solo consulta un gate financiero mínimo.

`erp_x_financial_gate` es la única excepción `SECURITY DEFINER` del slice financiero porque debe ser visible a actores con `orders.read` sin concederles lectura de facturas/holds/validaciones. Usa `search_path` explícito y no expone detalles financieros innecesarios.

## Consecuencias

- se evita confundir “validado” con “pagado”;
- pagos parciales se representan con múltiples facturas;
- reversos/anulaciones conservan historia;
- las decisiones financieras son explicables;
- la falta de una política de cupo real se hace visible;
- el dominio puede evolucionar a cuentas por cobrar/vencimientos reales sin romper el contrato de Orders.

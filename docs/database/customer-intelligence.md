# Customer Intelligence · modelo de datos

## Fuente de verdad económica

Para este CRM, una factura registrada representa dinero pagado.

Valor efectivo:

- REGISTERED = amount
- PARTIALLY_REVERSED = amount - reversed_amount
- REVERSED = 0
- VOID = 0

Múltiples facturas sobre un pedido representan pagos parciales/acumulados.

## Pedido válido

Se cuenta un pedido cuando pertenece a la organización, tiene customer_id, is_test=false y su estado es distinto de DRAFT y CANCELLED.

Un pedido válido puede tener pago cero y sigue aportando a la métrica de cantidad.

## Devoluciones y ajustes

La auditoría del CRM fuente encontró devoluciones físicas dentro del dominio de Recepción/Bodega, pero no un ledger financiero independiente de refund/nota crédito que deba alimentar Customer Intelligence.

Por tanto:

- una devolución física no resta dinero por inferencia;
- si el pedido queda CANCELLED, deja de contar como pedido válido;
- si la factura registrada se revierte total o parcialmente, el valor pagado disminuye con esa reversión;
- no se usa ninguna tercera métrica para compensar devoluciones.

## Tablas

- customers: identidad estable; una identidad provisional conserva su UUID si posteriormente recibe documento.
- invoices: ledger mínimo de pago proveniente de facturación.
- FKs compuestas impiden asociar customer_id o invoice/order entre organizaciones distintas.
- customer_intelligence_algorithm_versions: pesos/umbrales versionados.
- customer_intelligence_runs: ejecución y fingerprint.
- customer_intelligence_current: snapshot consultable.
- customer_intelligence_history: solo cambios significativos de segmento.
- customer_intelligence_state: dirty/último run.

## Pareto

Cada snapshot conserva participación individual de pedidos, participación individual de pago, acumulado de pedidos y acumulado de pago.

El sistema calcula la concentración real. No fuerza una distribución 80/20.

## Índices críticos

- orders(organization_id, customer_id, status, created_at).
- invoices(organization_id, order_id, status, invoice_date).
- (organization_id, overall_rank).
- (organization_id, segment, overall_rank).
- histórico por organización/cliente/fecha.

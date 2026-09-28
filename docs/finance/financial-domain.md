# Dominio financiero · Crédito, Cartera y Caja

Fecha de corte: 2026-09-28.

## Alcance

Este dominio reconstruye Crédito, Cartera y Caja sin copiar el monolito legado. Orders conserva la propiedad del workflow general; Finanzas expone decisiones explícitas y trazables.

Contratos principales:

- `erp_x_financial_gate(order_id)`: contrato mínimo para Orders.
- `erp_x_finance_order_summary(order_id)`: detalle financiero reservado a módulos financieros.
- `erp_x_finance_customer_paid(customer_id)`: proyección mínima para Customer Intelligence.
- colas paginadas para Crédito, Cartera/Caja y Aprobaciones.

## Auditoría del CRM anterior

Evidencia funcional revisada:

- `sql/migrations/001_core_schema.sql`: `credit_requests` y `financial_validations`.
- `sql/migrations/008_enterprise_controls.sql`: checklist de Cartera/Caja, incluyendo cupo/mora como verificación y soporte/referencia de pago.
- `sql/migrations/019_financial_routing_and_cash_invoice_v10_7.sql`: enrutamiento financiero.
- `assets/js/modules/credit.js`: solicitud de crédito con valor y plazo.
- `assets/js/modules/financial-flow.js`: decisiones de Cartera/Caja.
- `docs/CAMBIOS_FUNCIONALES_V10_7.md`: PVC/PVP a Cartera solo con mora marcada; PVN a Caja solo con retención.
- `supabase/migrations/080_gerencia_aprobacion_global_cartera_financiera_v11_8_1.sql`: aprobaciones de Gerencia.
- `supabase/migrations/127_customer_payment_truth_v11_39_1.sql`: lógica posterior de “payment truth” del legado.

### Resultado de la auditoría

No se encontró una cuenta persistente de cupo reutilizable con:

- límite aprobado permanente;
- crédito disponible calculable;
- fórmula auditable de consumo/liberación de cupo.

El legado sí tiene solicitudes de crédito con:

- valor solicitado;
- plazo solicitado;
- estado;
- responsable;
- decisión y motivo.

Por esa razón el CRM nuevo **no inventa** `available_credit`. El resumen devuelve `availableCredit = null` y `NO_AUDITED_REUSABLE_CREDIT_LIMIT`.

Tampoco se encontró un ledger auditable de vencimientos con `due_date` suficiente para derivar días de mora automáticamente. Cartera puede registrar una retención explicando mora/saldo externo, pero el sistema no fabrica días ni saldos vencidos.

## Fuente de verdad del valor pagado

La regla vigente del negocio es:

> factura registrada = evidencia del valor efectivamente pagado.

Por tanto:

- `REGISTERED`: `amount`.
- `PARTIALLY_REVERSED`: `amount - reversed_amount`.
- `REVERSED`: 0.
- `VOID`: 0.

`financial_validations` no contiene columna `amount` para impedir que una decisión se convierta accidentalmente en fuente monetaria.

No se asume:

- valor del pedido = valor pagado;
- valor solicitado en crédito = valor pagado;
- monto de una validación = valor pagado.

## Pagos parciales

El modelo permite múltiples facturas registradas por pedido. El valor pagado total es la suma neta de esas facturas.

No se sobrescriben importes anteriores.

## Reversos y anulaciones

Los reversos actualizan:

- `reversed_amount`;
- estado `PARTIALLY_REVERSED` o `REVERSED`;
- actor;
- fecha;
- razón.

La anulación deja estado `VOID` y conserva actor/fecha/razón.

Todos generan `financial_events`; los eventos no tienen UPDATE/DELETE para usuarios autenticados.

## Crédito

Se reconstruye la regla realmente demostrable:

1. un usuario con capacidad `credit.create` radica valor + plazo;
2. Cartera toma la solicitud;
3. un actor autorizado decide;
4. quien radicó no puede decidir su propia solicitud;
5. una solicitud ligada a pedido genera una validación CREDIT explícita.

No se crea automáticamente un cupo permanente.

## Cartera

Cartera puede:

- consultar su cola;
- registrar decisión;
- crear retención con código + razón + metadata mínima;
- solicitar una excepción de liberación;
- liberar una retención cuando las reglas lo permitan.

Una retención nunca es un booleano aislado. Conserva dominio, actor, fecha, razón y estado.

## Caja

Caja puede:

- consultar pendientes;
- registrar referencias de soporte sin guardar binarios en el dominio;
- validar/rechazar soporte;
- registrar factura pagada;
- registrar decisiones financieras.

Reversar o anular una factura exige capacidad de aprobación financiera; el rol operativo de Caja no obtiene esa autoridad por defecto.

## Aprobaciones y segregación

Excepciones soportadas:

- `CREDIT_EXCEPTION`;
- `RELEASE_EXCEPTION`;
- `PAYMENT_EXCEPTION`.

La misma persona que solicita una excepción no puede decidirla, incluso si es `super_admin`.

Las acciones de `super_admin` siguen generando auditoría.

## RLS / RBAC

PostgREST expone únicamente el esquema `public`; `erp_supply` y `erp_private` no forman parte de la superficie REST directa. Las operaciones financieras públicas se exponen mediante RPC controladas.

Las tablas financieras usan RLS por `organization_id`.

Reglas relevantes:

- Ventas puede radicar Crédito y solo ve sus propias solicitudes si no tiene capacidad de revisión/aprobación.
- Cartera puede revisar/decidir Crédito y operar Cartera según capacidades.
- Caja puede operar soportes/facturas/validaciones según capacidades.
- Gerencia decide excepciones y ajustes autorizados.
- Auditoría tiene lectura sin mutación.
- otra organización no puede leer datos financieros ajenos.

Los RPC son `SECURITY INVOKER` salvo `erp_x_financial_gate`, que es un contrato estrecho `SECURITY DEFINER` para Orders con `search_path` explícito y salida mínima: decisión, dominio, razón y actor/módulo requerido.

## Integración con Orders

Orders no modifica tablas financieras.

Consume `erp_x_financial_gate` y recibe:

- `APPROVED`;
- `REJECTED`;
- `ON_HOLD`;
- `REQUIRES_REVIEW`;
- `RELEASED`.

La UI de Orders muestra solo el estado financiero compacto. Facturas, soportes, aprobaciones y detalle permanecen en Finanzas.

Además, un trigger financiero de finalización veta el cambio de tareas `CARTERA`, `CAJA` y `CAJA_FACTURACION` a `COMPLETED` cuando `erp_x_financial_gate` no devuelve `APPROVED` o `RELEASED`. Finanzas no avanza Orders; únicamente impide que Orders salte el gate.

## Integración con Customer Intelligence

El contrato `erp_x_finance_customer_paid` expone únicamente:

- `customerId`;
- `totalPaid`;
- `invoiceCount`;
- `source = REGISTERED_INVOICES_NET_OF_REVERSALS`.

Customer Intelligence no necesita conocer tablas internas del dominio financiero.

## Dinero y redondeo

- moneda auditada actual: COP;
- PostgreSQL `numeric`;
- redondeo central: `erp_private.finance_round_money(...)` a dos decimales;
- JavaScript no realiza cálculos monetarios críticos.

## Idempotencia y concurrencia

Operaciones críticas usan:

- idempotency key única por organización;
- `pg_advisory_xact_lock` derivado de organización + scope + key;
- `FOR UPDATE` en decisiones de estado.

Pruebas de concurrencia cubren:

- doble retry de factura;
- validación simultánea del mismo soporte;
- decisión simultánea de la misma solicitud de crédito.

## Datos sintéticos y no producción

Todas las pruebas financieras usan Supabase local + fixtures QA.

No se modifican:

- Supabase productivo;
- facturas reales;
- pagos reales;
- clientes reales;
- usuarios reales;
- Vercel productivo.

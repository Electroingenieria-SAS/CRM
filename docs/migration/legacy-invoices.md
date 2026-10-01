# Hilo 15 — Tratamiento de facturas legacy sin monto

El preflight de 2026-09-30 encontró:

- 4 registros en `erp_supply.invoices`;
- 1 con monto positivo, asociado al pedido actualmente `IN_PROGRESS`;
- 3 con `amount IS NULL`, todos `REGISTERED`, asociados a pedidos PVC `CLOSED`;
- las tres metadata solo contienen referencias operativas como `automaticRecord`, `fileName`, `registeredStep`, `source` y `taskId`; no existe un monto financiero recuperable en la propia factura.

## Decisión

1. La factura con monto positivo se migra al ledger `erp_supply.invoices` del CRM nuevo.
2. Los tres registros sin monto **no se convierten en facturas monetarias** porque el modelo nuevo exige `amount > 0` y Customer Intelligence usa el ledger como fuente de valor efectivamente pagado.
3. Esos tres registros se conservan como referencia histórica/auditable ligada al pedido (número, fecha, archivo/referencia y metadata permitida), sin aportar valor pagado.
4. Está prohibido completar el monto desde `financial_validations.amount` o inferirlo desde otra cifra no documentada.
5. Si antes del freeze aparece evidencia financiera primaria del monto, puede reclasificarse mediante mapping documentado y reconciliación monetaria.

El reconciliador compara el conteo de **facturas operativas con monto > 0** y el total monetario por moneda; las referencias históricas sin monto se auditan aparte.

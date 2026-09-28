# Runbook · Customer Intelligence

## Cuándo recalcular

Recalcular cuando el estado muestre “Actualización pendiente”, normalmente después de crear/cambiar un pedido válido, cancelar un pedido, registrar factura, revertir total o parcialmente una factura o activar una nueva versión del algoritmo.

No recalcular en cada render. Pedidos y facturas solo marcan el dataset como pendiente; el cálculo exacto se ejecuta por lote porque percentiles, ranking y Pareto dependen de toda la población.

## Procedimiento

1. Confirmar que CI y DB gates están verdes.
2. Ingresar con capacidad customer_intelligence.admin.
3. Ejecutar erp_x_customer_intelligence_recalculate() o usar Recalcular en la UI.
4. Verificar success=true.
5. Si reused=true, el dataset no cambió.
6. Verificar customer_intelligence_state.dirty_since is null.
7. Abrir ranking/Pareto y revisar un cliente de control.

## Concurrencia

El motor usa pg_advisory_xact_lock derivado del UUID de organización. Dos recalculados de la misma organización se serializan; organizaciones diferentes no se bloquean entre sí.

## Error

El recalculado corre en una sola transacción. Si falla, PostgreSQL revierte el intento completo y el snapshot vigente permanece intacto; el error de la RPC se propaga al cliente sin exponer consultas ni secretos.

Revisar primero migraciones, RLS/permisos, algoritmo activo, consistencia de facturas y estado de pedidos.

No corregir con SECURITY DEFINER adicional ni deshabilitando RLS.

## Cambio de algoritmo

Nunca editar silenciosamente 1.0.0. Crear una nueva versión, activar una sola por organización, recalcular y conservar histórico.

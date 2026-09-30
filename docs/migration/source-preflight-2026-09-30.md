# Hilo 15 — Preflight de origen productivo

Corte: 2026-09-30  
Proyecto Supabase origen: `hezjxcxxcjlpmyalftam`

## Resultado de controles críticos

Resultado: **15/15 PASS**

- profiles_without_org: 0
- profiles_with_missing_auth_user: 0
- profile_roles_without_profile: 0
- profile_roles_without_role: 0
- orders_without_org: 0
- order_items_without_order: 0
- invoices_without_order: 0
- deliveries_without_order: 0
- inventory_items_without_org: 0
- inventory_lots_without_item: 0
- inventory_negative_available: 0
- inventory_negative_reserved: 0
- inventory_negative_blocked: 0
- movements_without_item: 0
- reservations_without_order: 0

## Snapshot agregado

- organizations: 1
- profiles: 33
- profile_roles: 21
- orders: 4
- order_items: 4
- invoices: 4
- material_master: 1.959
- inventory_items: 1.960
- inventory_lots: 2.963
- inventory_movements: 5
- material_reservations: 2
- work_assignments: 4
- work_executions: 8
- deliveries: 3
- freight_route_reference: 166
- system_audit: 9.488
- orders: 3 CLOSED + 1 IN_PROGRESS
- invoice aggregate: COP 1,00 en el snapshot actual
- inventory lot aggregate: available 1.822.660,43; reserved 64.928,84; blocked 0

Estos valores son **baseline de preflight**, no cifras congeladas de cutover. Deben recapturarse después del freeze y antes de validar el destino.

## Edge Functions

El proyecto legado mantiene cuatro funciones activas. `erp-auditoria-metrics` continúa desplegada de forma pública. En la ventana observada se registraron 18 GET exitosos sin `Authorization`, `Origin`, `Referer` ni `User-Agent`; existe por tanto un consumidor real no identificado. El CRM nuevo no depende de esta función y no la migra. Su hardening definitivo queda separado del cutover hasta identificar/adaptar ese consumidor.

## Conclusión

El origen no presenta inconsistencias referenciales críticas detectables por este preflight. Esto habilita preparar el dry-run, pero no sustituye backup, restore rehearsal ni reconciliación destino.

## Fuente viva antes del freeze

Los valores anteriores son observaciones pre-freeze, no baseline final. Durante Hilo 15 se observaron dos snapshots válidos con una diferencia de 8 unidades en el agregado de inventario. La comprobación mostró 2.963 lotes activos y 0 inactivos, por lo que la diferencia corresponde a cambio operativo del origen entre lecturas, no a un filtro de migración.

Consecuencia: el baseline definitivo se captura **después del freeze** y es el único que Hilo 16 debe usar para detectar drift posproducción.

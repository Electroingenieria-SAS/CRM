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

El proyecto legado mantiene cuatro funciones activas. `erp-auditoria-metrics` tiene `verify_jwt=false`. Búsqueda de código confirmó referencias documentales/configuración en el legado, pero no llamadas de runtime en `src`, `public` o `supabase/functions`; el CRM nuevo tampoco la referencia. No se migra tal cual. Cualquier retiro del legado debe hacerse en ventana coordinada.

## Conclusión

El origen no presenta inconsistencias referenciales críticas detectables por este preflight. Esto habilita preparar el dry-run, pero no sustituye backup, restore rehearsal ni reconciliación destino.

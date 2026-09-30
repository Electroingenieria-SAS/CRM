# Hilo 15 — Clasificación de datos de migración

Snapshot de origen: 2026-09-30. Los conteos indicados son exactos para las tablas listadas; otros datasets deben volver a contarse en la ventana de cutover.

| Dataset | Evidencia actual | Decisión | Regla |
| --- | ---: | --- | --- |
| Organizaciones | 1 | MIGRAR | preservar ID si el destino es nuevo |
| Auth users | 32 activos | MIGRAR con mecanismo soportado | no copiar contraseñas/MFA manualmente |
| Perfiles | 33 | MIGRAR | preservar relación con Auth y organización |
| Roles | 14 | RECONSTRUIR + reconciliar | catálogo viene de migraciones; asignaciones sí se migran |
| Permisos módulo/rol | 133 | RECONSTRUIR + reconciliar | fuente destino = migraciones versionadas |
| Pedidos | 4 | MIGRAR | activos con estado completo; cerrados pueden simplificarse |
| Líneas de pedido | 4 | MIGRAR | preservar relación pedido/material |
| Facturas | 4 | MIGRAR | P0 monetario; no inventar valores |
| Crédito/cartera | 0 solicitudes visibles en snapshot | MIGRAR SI EXISTE al corte | reconciliar saldos y estados |
| Compras | 0 órdenes visibles | MIGRAR SI EXISTE al corte | activos completos; históricos solo si aportan trazabilidad |
| Recepción | 1 warehouse receipt visible | MIGRAR | preservar relación con compra/pedido/material |
| Material master | 1.959 | MIGRAR | normalizar identidad estable |
| Inventory items | 1.960 | MIGRAR | usar opening balance si el destino usa ledger nuevo |
| Inventory movements | 5 | MIGRAR | preservar movimientos confiables; no derivar saldo sin conciliación |
| Workforce assignments | 4 | MIGRAR PARCIALMENTE | activos/futuros completos; históricos según valor analítico |
| Workforce executions | 8 | MIGRAR PARCIALMENTE | preservar activos y evidencia necesaria |
| Freight route reference | 166 | MIGRAR | no recalcular manualmente; validar integridad |
| Deliveries | 3 | MIGRAR | preservar estimado vs real y evidencia/referencias |
| Audit ledger | 9.488 | ARCHIVAR + MIGRAR PARCIALMENTE | conservar legal/seguridad y ventana reciente; evitar ruido histórico muerto |
| Evidencias legacy | ~283 referencias en `public.evidences` | MIGRAR PARCIALMENTE | validar URL/ownership; no duplicar binarios |
| Supabase Storage | 0 buckets | NO MIGRAR | no existen objetos Storage en el snapshot |
| Catálogos/config | versionados | RECONSTRUIR | destino se levanta desde migraciones/seed |
| Métricas derivadas | recalculables | NO MIGRAR | recalcular en destino |
| Customer Intelligence score/segmento | derivado | RECONSTRUIR | recalcular desde pedidos + valor efectivamente pagado |
| Edge Functions legacy | 4 activas | MIGRAR SELECTIVAMENTE | desplegar solo funciones requeridas por CRM nuevo |
| `erp-auditoria-metrics` | verify_jwt=false | NO MIGRAR tal cual | retirar o endurecer antes de cualquier reutilización |

## Regla de históricos

Migrar solo información con valor operativo, legal, financiero, analítico o de trazabilidad. Datos derivados, métricas recalculables y ruido de QA no se trasladan como fuente de verdad.

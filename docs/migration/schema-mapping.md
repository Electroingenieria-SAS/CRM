# Hilo 15 — Mapeo de esquema e identidades

## Estrategia de IDs

1. En un Supabase nuevo, preservar UUID de negocio siempre que no exista conflicto.
2. Auth se migra únicamente mediante mecanismo soportado por Supabase; no se insertan secretos MFA manualmente.
3. Si Auth obliga a remapear un `auth.users.id`, registrar correspondencia `legacy_auth_user_id → target_auth_user_id` y actualizar `profiles.auth_user_id` de forma transaccional.
4. IDs de pedidos, materiales, facturas y movimientos se preservan cuando sea posible para mantener referencias externas/auditoría.
5. Nunca mezclar preservación/remapeo sin una tabla de correspondencia versionada en el batch de migración.

## Mapa por entidad

| Origen | Destino CRM nuevo | Transformación principal | Validación |
| --- | --- | --- | --- |
| `erp_supply.organizations` | `erp_supply.organizations` | preservar UUID/code/timezone | 1:1 y unique code |
| `auth.users` | Supabase Auth destino | mecanismo soportado; no secretos manuales | usuario/perfil/roles |
| `erp_supply.profiles` | `erp_supply.profiles` | normalizar email; remap auth_user_id si aplica | org + rol + activo |
| `erp_supply.profile_roles` | `erp_supply.profile_roles` | preservar roles válidos | FK perfil/rol |
| roles/permisos legacy | seed/migraciones destino + asignaciones | catálogo reconstruido | diff de capacidades |
| `erp_supply.orders` | `erp_supply.orders` | mapear catálogos/estado/paso/responsable | activos por etapa |
| `erp_supply.order_items` | `erp_supply.order_items` | material/reference/unit | FK pedido/material |
| `erp_supply.invoices` | Finance/Invoices destino | conservar número, estado y valor real | reconciliación monetaria |
| `erp_supply.material_master` | material master destino | identidad estable + unidad | duplicados/documento lógico |
| `erp_supply.inventory_items` + lotes | inventory balances/ledger destino | opening balance trazable cuando aplique | on_hand/reserved/available |
| `erp_supply.inventory_movements` | inventory movements destino | preservar eventos confiables | saldo reconstruible |
| `erp_supply.work_assignments` / executions | Workforce destino | activos/futuros completos; histórico selectivo | actividad/responsable/estado |
| freight reference/history | Freight Intelligence destino | normalizar destino/transportadora | observaciones y rangos |
| `erp_supply.deliveries` | Logistics destino | separar estimado/real/evidencia | estado + costo + pedido |
| `erp_supply.system_audit` | Audit destino/archivo | ventana y eventos críticos | append-only / actor / fecha |
| `public.evidences` | referencias de evidencia destino | URL + metadata + ownership | accesibilidad y permiso |

## Field-level checklist obligatorio por batch

Cada extractor/importador debe declarar explícitamente:

`source_table.source_column → target_table.target_column | transform | default | nullable | validator`.

No se aprueba un batch si esa especificación no acompaña el script/import job correspondiente.

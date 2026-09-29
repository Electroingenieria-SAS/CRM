# Analítica operacional

## Alcance

La capa Analytics consume contratos ya existentes de Orders, Workforce, Customer Intelligence,
Freight, Finance e Inventory. No redefine reglas transaccionales ni escribe en sus tablas.

Arquitectura:

```
Domain data
  -> read models / analytics application
  -> reporting queries
  -> UI
```

Las rutas son:

- `/analytics`: dashboard operacional;
- `/analytics/vsm`: VSM agregado y por pedido;
- `/analytics/reports`: explorador paginado;
- `/analytics/imports`: preview, staging y aplicación de históricos.

## Read models y RPC

- `erp_x_analytics_dashboard`: una lectura agregada para el panel;
- `erp_x_analytics_vsm_summary`: distribución de tiempos por etapa;
- `erp_x_analytics_order_vsm`: ciclo de un pedido;
- `erp_x_analytics_report_catalog`: reportes visibles según RBAC;
- `erp_x_analytics_report`: explorador paginado;
- `erp_x_analytics_import_preview`: validación y staging;
- `erp_x_analytics_import_apply`: aplicación idempotente;
- `erp_x_analytics_imports`: trazabilidad de lotes.

`erp_private.analytics_stage_metrics` reutiliza el calendario laboral oficial de Workforce y
`workforce_profile_policies` continúa siendo la fuente de exclusiones humanas donde corresponda.

## Fuentes

### Orders

Fuente primaria para:

- volumen;
- estados;
- etapas;
- bloqueos;
- lead time del pedido;
- waiting, processing y blocked time de tareas.

### Workforce

Se consume `erp_x_order_workforce_indicators`; Analytics no recalcula ocupación, disponibilidad
ni exclusiones de perfiles.

### Customer Intelligence

Se consume `customer_intelligence_current`. Valor pagado continúa proveniente del ledger de
facturas registrado por ese dominio.

### Freight

Se consume `erp_x_freight_metrics` y `freight_observations`. Analytics no modifica el algoritmo
de predicción.

### Inventory

Se leen balances ya materializados. La disponibilidad sigue siendo:

`on_hand - reserved - committed`.

Analytics no declara “inventario crítico” porque todavía no existe un umbral confiable de
reposición por material.

### Logistics

Mientras el dominio Logistics no exista en `main`, el dashboard usa la etapa del pedido para
“entregas pendientes”. Cuando `erp_supply.logistics_shipments` esté disponible, el read model la
detecta y expone estados de envío sin necesitar una migración analítica adicional.

## Seguridad

Todas las consultas públicas verifican capacidades de módulo. Los read models privados validan
que el `organization_id` recibido coincida con la organización de la sesión.

No existe service role en el navegador.

Permisos actuales:

- `dashboard.read`: roles operativos activos;
- `vsm.read`: auditoría, coordinación/jefatura/liderazgo logístico, gerencia y superadmin;
- `reports.read`: perfiles con necesidad de exploración;
- `imports.read`: auditoría, gerencia y superadmin;
- `imports.create`: superadmin.

La exportación registra reporte, filtros, actor, fecha y número de filas.

## Performance

El dashboard usa una consulta agregada; no existe una llamada por tarjeta ni polling.

Los reportes:

- máximo 100 filas por página;
- filtros en SQL;
- exportación limitada a la página visible;
- índices solo para filtros temporales/read models demostrados.

Las consultas VSM operan sobre eventos/tareas, no descargan eventos completos al navegador.

## Materialización

No se incorporaron materialized views en este slice. Las consultas actuales son acotadas,
indexadas y necesitan frescura operacional. Si el volumen futuro demuestra un costo alto con
`EXPLAIN (ANALYZE, BUFFERS)`, la decisión debe documentar estrategia de refresh antes de
materializar.

## Accesibilidad y responsive

Las visualizaciones tienen títulos y equivalentes textuales; las barras no son la única forma de
leer un valor. En móvil se priorizan cards/listas sobre tablas.

Los breakpoints E2E cubren 320, 375, 390, 430, 768, 1024, 1366 y 1920 px.

## P0 / P1 / P2

### P0

- RLS y aislamiento por organización;
- RBAC en RPC;
- importaciones sin DML directo a operación;
- idempotencia por checksum y external key;
- paginación/control de exportación;
- fixtures exclusivamente sintéticos.

### P1

- dashboard operacional;
- VSM y percentiles;
- report explorer;
- preview + errores por fila;
- catálogo central de KPI;
- trazabilidad de export/import.

### P2

- materialización selectiva si métricas reales la justifican;
- XLSX server-side si aparece un caso de uso que no pueda cubrir CSV paginado;
- alertas configurables por KPI;
- series temporales ejecutivas cuando exista suficiente historia homogénea.

# Analítica operacional, VSM, reportes e históricos

## Alcance

Esta capa consume contratos ya existentes de Orders, Workforce, Customer Intelligence, Freight,
Finance e Inventory. No reimplementa sus reglas transaccionales. Logistics se integra de forma
opcional cuando su tabla contractual exista; mientras el PR de Logistics no esté fusionado, la
analítica de entregas usa únicamente las etapas de Orders y marca la fuente Logistics como no
disponible.

Flujo arquitectónico:

```text
Domain data
  -> read models / analytics application
  -> reporting RPC
  -> UI
```

Dashboard, VSM y Reportes no escriben tablas internas de otros dominios.

## Catálogo de KPIs

La fuente documental y ejecutable es `erp_supply.analytics_kpi_catalog`.

| KPI | Definición | Fuente | Filtro temporal |
| --- | --- | --- | --- |
| ORDERS_TOTAL | Pedidos creados dentro del rango. | orders | created_at |
| ORDERS_ACTIVE | Pedidos activos que intersectan el rango. | orders | ciclo activo |
| ORDERS_CLOSED | Pedidos cerrados dentro del rango. | orders | closed_at |
| ORDERS_BLOCKED | Pedidos bloqueados o con bloqueo abierto. | orders + order_blocks | snapshot/rango |
| FINANCIAL_PENDING | Pedidos actualmente en Cartera/Caja/Facturación Caja. | orders.current_step_code | snapshot/rango |
| DELIVERIES_PENDING | Pedidos activos en etapas de entrega/cierre. | orders.current_step_code | snapshot/rango |
| WORKFORCE_OCCUPIED | Personas ocupadas/bloqueadas. | erp_x_order_workforce_indicators | rango Workforce |
| WORKFORCE_AVAILABLE | Personas disponibles. | erp_x_order_workforce_indicators | rango Workforce |
| VSM_LEAD_TIME | Tiempo laboral creación -> cierre/corte. | Orders + calendario Workforce | por pedido |
| VSM_WAITING_TIME | Creación de etapa -> inicio efectivo. | order_tasks | por etapa |
| VSM_PROCESSING_TIME | Tiempo laboral iniciado menos bloqueo explícito. | order_tasks + order_blocks | por etapa |
| VSM_BLOCKED_TIME | Intervalos de bloqueo explícito. | order_blocks | por etapa |

No se publica "inventario crítico" porque Inventory no dispone todavía de un umbral de criticidad
confiable. El dashboard sí puede mostrar físico, reservado, comprometido, disponible y saldos
totalmente asignados.

## Read models

- `erp_private.analytics_stage_metrics`: separa espera, proceso, bloqueo y ciclo de etapa usando
  `erp_private.workforce_business_seconds`.
- `erp_private.analytics_stage_metrics_all`: combina operación vigente e históricos importados
  sin escribir sobre Orders.
- `erp_x_analytics_dashboard`: una respuesta agregada para cards, colas, alertas y fuentes
  reutilizadas. Evita una llamada por tarjeta.
- `erp_x_analytics_vsm_summary`: agregación VSM por etapa.
- `erp_x_analytics_order_vsm`: trazabilidad VSM de un pedido operativo o histórico.
- `erp_x_analytics_report`: explorador paginado reutilizable.
- `erp_x_analytics_report_catalog`: reportes disponibles según fuentes y permisos.

No se crean materialized views en este checkpoint: las consultas están acotadas, filtradas e
indexadas y todavía no existe evidencia de costo que justifique refresh y eventual consistencia.

## VSM

### Semántica

- waiting: desde creación de la etapa hasta inicio efectivo;
- processing: tiempo laboral iniciado menos bloqueos explícitos;
- blocked: intervalos de bloqueo explícito;
- transit: solo cuando existe una fuente explícita de tránsito;
- total: ciclo de etapa;
- lead time: tiempo laboral desde creación del pedido hasta cierre o instante de corte.

`closed_at - created_at` nunca se denomina tiempo productivo.

### Agregados

Por etapa se calculan cantidad, promedio, mediana, P75, P90 y P95. Los cuellos de botella muestran
evidencia por etapa: espera, ciclo total, P90, cola actual y pedidos bloqueados. No se etiqueta a
personas como responsables del cuello de botella.

Las exclusiones humanas configuradas siguen perteneciendo a Workforce y se respetan consumiendo
su RPC oficial; Analytics no hardcodea nombres.

## Dashboard

La superficie ejecutiva prioriza volumen y estados. La superficie operativa prioriza colas,
bloqueos, SLA y disponibilidad Workforce. Alertas se limitan a señales accionables y no convierten
todos los estados en alertas.

Fuentes opcionales aparecen solo cuando el perfil tiene permiso y el contrato existe. En
particular, Logistics se detecta sin crear dependencia de migración con un PR todavía abierto.

## Reportes y exportación

Un único explorador soporta actualmente:

- pedidos;
- tiempos por etapa;
- Workforce;
- clientes;
- inventario;
- fletes;
- Logistics cuando su contrato exista.

Compras, Recepción, Alistamiento y Corte se incorporarán como reportes de dominio cuando sus
fuentes propias estén fusionadas en `main`; sus etapas ya participan en VSM cuando Orders produce
eventos confiables.

Cada consulta está paginada, con máximo 100 filas por página. La exportación implementada es CSV
de la página filtrada visible y registra actor, reporte, filtros, formato y cantidad de filas.
No existe endpoint de service role ni descarga indiscriminada de la base. XLSX no se agrega porque
CSV cubre el caso actual sin introducir una dependencia adicional.

## Importación histórica

Tipo inicial: `ORDER_STAGE_HISTORY_V1`.

Flujo:

```text
CSV
  -> checksum SHA-256
  -> preview
  -> analytics_import_batches / analytics_import_rows
  -> validación y normalización
  -> analytics_historical_stage_events
```

Restricciones:

- máximo 10 MB y 2.000 filas por archivo;
- SHA-256 único por organización + tipo;
- externalKey único por organización + fuente;
- etapas validadas contra workflow_steps;
- fechas ordenadas;
- segundos no negativos;
- ningún insert directo en Orders, Workforce, Inventory, Finance o Logistics.

Política: `VALID_ROWS_PLUS_REJECTED_REPORT`. Las filas válidas se aplican; inválidas o duplicadas
quedan reportadas por fila con campo, código y causa. Repetir el mismo archivo devuelve el lote
existente en lugar de duplicar datos.

El binario del archivo no se persiste: se conserva nombre, checksum, tamaño, fuente, actor, fecha,
conteos, errores normalizados y resultado. Así se obtiene trazabilidad sin almacenar una segunda
copia innecesaria del histórico.

## Seguridad

- todas las consultas parten de `current_org_id()`;
- históricos, lotes y auditoría de exportación tienen RLS;
- no hay DML directo de `authenticated` sobre staging/históricos;
- mutaciones pasan por RPC con chequeo de capacidad;
- Dashboard requiere dashboard.read + orders.read;
- VSM requiere vsm.read + orders.read;
- Reportes requieren reports.read y además permiso del dominio fuente;
- Importaciones: lectura para Auditoría/Gerencia/Superadmin; creación únicamente Superadmin;
- exportaciones respetan la misma sesión y no usan service role.

## Rendimiento

Presupuesto actual:

- Dashboard: una llamada agregada, sin polling;
- VSM: una llamada por vista y otra solo al abrir un pedido;
- Reportes: una llamada paginada;
- Importaciones: preview acotado a 2.000 filas;
- UI nunca descarga miles de filas para sumar en JavaScript.

Índices añadidos están ligados a consultas concretas sobre task/block time e import batches. No se
añaden índices especulativos. Si cardinalidad futura demuestra degradación, se evaluará EXPLAIN
sobre las consultas críticas antes de materializar o indexar adicionalmente.

## Responsive y accesibilidad

Se validan 320, 375, 390, 430, 768, 1024, 1366 y 1920 px. En móvil predominan cards y listas.
Las barras tienen texto equivalente y aria-label; títulos y estados no dependen solo de color.
Los controles mantienen labels y targets táctiles de al menos 44 px.

## Pruebas

- unit: fórmulas de tiempos, percentiles, rango de fechas y CSV;
- pgTAP: RLS, KPI catalog, tiempos, filtros, reportes, export audit e import idempotency;
- E2E: dashboard -> filtro -> VSM -> reporte -> exportación;
- E2E import: archivo sintético -> preview -> aplicación parcial -> replay checksum;
- responsive: anchos de referencia;
- cross-browser: rutas Analytics dentro de la matriz existente.

Todos los fixtures son sintéticos y Supabase local/CI.

# Handoff Hilo 15 → Hilo 16 — Estabilización posproducción

Estado: Hilo 16 puede preparar observabilidad y smoke, pero **no debe declarar estabilización productiva antes del GO/cutover de Hilo 15**.

## Ownership

### Hilo 15

- backup / restore rehearsal;
- dry-run de migración;
- reconciliación de datos;
- Auth migration;
- Preview/release candidate;
- freeze + cutover + rollback;
- smoke inmediato de release;
- registro final de SHA/dataset/infra.

### Hilo 16

- observabilidad y baseline post-release;
- smoke repetible no destructivo;
- clasificación de regresiones;
- errores/runtime/performance;
- incidentes y rollback recommendation;
- correcciones pequeñas de bugs/regresiones;
- cierre de estabilización.

Hilo 16 **no** debe:

- migrar o reescribir datos;
- crear un segundo pipeline de cutover;
- cambiar reglas de mapping;
- reabrir módulos funcionales ya UAT;
- convertir una diferencia de migración en “bug de aplicación” sin verificar Hilo 15.

## Inputs que Hilo 15 entrega

Antes del GO:

- source preflight 15/15 PASS;
- snapshot agregado del origen;
- 1 pedido en vuelo identificado para reconciliación;
- scripts de snapshot/reconcile;
- estrategia Auth;
- runbook de cutover/rollback.

Después del cutover:

- SHA exacto desplegado;
- URL/deployment ID;
- project ref Supabase destino;
- timestamp de freeze/cutover;
- resultados de reconciliación;
- smoke inmediato;
- diferencias aceptadas, si existen.

## Señales iniciales para Hilo 16

Durante estabilización medir, sin exponer PII:

- auth/login failures;
- 4xx/5xx por módulo;
- RLS/authorization denials inesperados;
- latency de rutas críticas;
- fallos de outbox/integraciones;
- pedidos atascados por etapa;
- errores de inventario/reservas;
- diferencias de Dashboard/read models;
- errores PACO;
- métricas Vercel/Supabase disponibles.

## Baseline de migración para comparar

El snapshot 2026-09-30 antes de freeze tiene:

- 1 organización;
- 33 perfiles;
- 21 profile_roles;
- 4 pedidos (3 CLOSED, 1 IN_PROGRESS);
- 4 facturas;
- 1.959 materiales;
- 1.960 inventory items;
- 2.963 inventory lots;
- 5 inventory movements;
- 2 material reservations;
- 4 Workforce assignments;
- 8 executions;
- 3 deliveries;
- 166 freight references;
- 9.488 audit events.

Inventario agregado baseline:

- available 1.822.660,43;
- reserved 64.928,84;
- blocked 0.

Estos números se vuelven a capturar en freeze; Hilo 16 debe usar el baseline final del cutover, no asumir que estos valores permanecen estáticos.

## Pedido en vuelo

En el snapshot actual existe 1 pedido en `LOCAL_DISPATCH`:

- 4 tareas;
- 1 factura;
- 1 reserva consumida;
- 0 entregas.

Hilo 16 debe comprobar que después del cutover no aparezca una transición artificial, entrega duplicada o pérdida de responsable/estado.

## Regla de coordinación

Si Hilo 16 detecta:

- **diferencia de datos/reconciliación** → Hilo 15;
- **regresión de código/UI/API** → Hilo 16;
- **duda de ownership** → bloquear corrección hasta reproducir y clasificar.

No hacer dual-write ni reparar producción manualmente desde ambos hilos.

## Fuente viva antes del freeze

Los valores anteriores son observaciones pre-freeze, no baseline final. Durante Hilo 15 se observaron dos snapshots válidos con una diferencia de 8 unidades en el agregado de inventario. La comprobación mostró 2.963 lotes activos y 0 inactivos, por lo que la diferencia corresponde a cambio operativo del origen entre lecturas, no a un filtro de migración.

Consecuencia: el baseline definitivo se captura **después del freeze** y es el único que Hilo 16 debe usar para detectar drift posproducción.

## Intentos de staging Supabase

- Proyecto nuevo `crm-reconstruction-staging`: costo reportado **USD 0/mes**; creación rechazada porque un miembro administrador ya alcanzó el límite de **2 proyectos Free activos**.
- Development Branch `hilo15-migration-rehearsal`: costo reportado **USD 0,01344/h**; creación rechazada porque Supabase Branching requiere plan **Pro o superior**.
- Decisión: no pausar/eliminar proyectos desconocidos y no subir de plan. El rehearsal se ejecuta con PostgreSQL/Supabase local efímero y el acceso al origen se entrega únicamente como secreto protegido `MIGRATION_SOURCE_DB_URL`; no se exige staging remoto.

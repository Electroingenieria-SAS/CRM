# Workforce · modelo de datos y contratos

Fecha: 2026-09-28.

## Entidades

### workforce_activity_catalog

Catálogo editable por organización. Conserva categoría, subcategoría, actividad específica, duración estándar, roles permitidos y política de evidencia. React no contiene listas operativas hardcodeadas.

### workforce_activities

Agregado principal de planificación/ejecución:

- organización;
- catálogo;
- responsable;
- creador/asignador;
- título/descripción;
- estado;
- fuente;
- inicio/fin planificado;
- inicio/fin real;
- referencia opcional a pedido/tarea;
- versión de concurrencia;
- metadata.

No replica cliente, vendedor, dirección ni materiales de Orders.

### workforce_activity_evidence

Guarda únicamente referencias de evidencia. El binario vive detrás de `EvidenceStoragePort`.

### workforce_activity_events

Ledger append-only de creación, asignación, inicio, bloqueo, reanudación, evidencia, cierre y cancelación.

### workforce_schedule_segments

Jornada por día ISO. Baseline: lunes a viernes, 07:00–12:00 y 13:40–17:30.

### workforce_holidays

Calendario persistido y versionable por organización/año. Sábados y domingos no reciben segmentos ordinarios.

### workforce_profile_policies

Excepciones explícitas por `profile_id`, entre ellas exclusión de métricas de ocupación/tiempo. Ninguna regla compara nombres de personas.

## Integridad temporal

- `planned_end > planned_start`;
- `actual_end >= actual_start`;
- la planificación debe quedar completamente dentro de segundos laborales;
- una constraint GiST impide solapamientos activos por responsable;
- estados finales no pueden volver a iniciarse;
- un cierre requiere evidencia según el catálogo.

## Concurrencia e idempotencia

Las mutaciones críticas:

- create;
- assign;
- start;
- block/resume;
- complete;
- cancel;
- add evidence;

usan clave de idempotencia. Un advisory lock transaccional serializa la misma clave y el agregado se bloquea con `FOR UPDATE`. `version` implementa optimistic concurrency.

## Índices

Se indexa por:

- organización + responsable + intervalo + estado;
- organización + intervalo;
- referencia a Orders;
- timeline de eventos;
- evidencia;
- festivos.

La consulta Día/Semana/Mes carga un rango completo; no ejecuta una consulta por persona/franja.

## API

RPC públicas `SECURITY INVOKER`:

- `erp_x_workforce_catalog`;
- `erp_x_workforce_schedule`;
- `erp_x_workforce_activity_detail`;
- `erp_x_workforce_create_activity`;
- `erp_x_workforce_assign_activity`;
- `erp_x_workforce_start_activity`;
- `erp_x_workforce_block_activity`;
- `erp_x_workforce_resume_activity`;
- `erp_x_workforce_complete_activity`;
- `erp_x_workforce_cancel_activity`;
- `erp_x_workforce_add_evidence`;
- `erp_x_workforce_set_profile_policy`;
- `erp_x_workforce_indicators`.

Los helpers privilegiados están en `erp_private`, tienen `search_path` explícito y no se exponen a `anon`.

## Plan Free

No existe polling continuo. La UI refresca después de:

- navegación de periodo;
- creación;
- reasignación;
- transición;
- evidencia.

La vista de cronograma usa una llamada agregada por rango.

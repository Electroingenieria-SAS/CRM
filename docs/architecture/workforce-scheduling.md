# Workforce / Jornada / Cronograma · auditoría y diseño

Fecha de corte: 2026-09-28.

## Evidencia del CRM fuente

La referencia funcional verificada conserva:

- módulo transversal `workforce`;
- catálogo canónico administrable, no hardcodeado en frontend;
- categoría, subcategoría y actividad específica;
- evidencias `NONE | FINAL_PHOTO | BEFORE_AFTER | FILE | LINK | ERP_REFERENCE`;
- jornada ordinaria lunes a viernes: 07:00–12:00 y 13:40–17:30;
- cronograma Día/Semana/Mes;
- exclusión de sábados, domingos y festivos;
- inicio directo de actividad sin aprobación previa de jefatura;
- alerta operativa al superar 60 minutos;
- tratamiento especial histórico para un perfil concreto;
- referencias a Orders sin duplicar cliente/materiales;
- evidencia binaria almacenada fuera del dominio y referenciada por metadata.

El legado contiene lógica histórica repartida entre asignaciones, ejecuciones y varias migraciones. La reconstrucción no copia ese modelo de forma literal.

## Límites del dominio nuevo

```text
UI Workforce
  ↓
Application
  ↓
Domain + ports
  ↓
Composition
  ↓
Infrastructure / RPC
  ↓
PostgreSQL + RLS
```

Orders publica eventos de integración. Workforce puede guardar `order_id` / `order_task_id`, pero Orders no importa Workforce.

## Modelo objetivo

- `workforce_activity_catalog`: catálogo administrable.
- `workforce_activities`: planificación + ejecución como agregado.
- `workforce_activity_evidence`: referencias de evidencia; nunca binarios.
- `workforce_activity_events`: historial append-only e idempotencia.
- `workforce_schedule_segments`: jornada por día de semana.
- `workforce_holidays`: festivos versionables por año.
- `workforce_profile_policies`: excepciones configurables por `profile_id`.

## Estados

`PLANNED → IN_PROGRESS → COMPLETED`

Estados laterales:

- `BLOCKED`: requiere reanudación antes de completar;
- `CANCELLED`: terminal.

No existe aprobación de jefe para el cierre normal.

## Ocupación

- `OUT_OF_SCHEDULE`: fuera de segmento laboral, fin de semana o festivo;
- `BLOCKED`: actividad activa bloqueada;
- `OCCUPIED`: actividad real en curso o planificación que cubre el instante;
- `AVAILABLE`: dentro de jornada sin ocupación.

Una actividad especial/excluida sigue siendo visible; la exclusión solo afecta métricas configuradas.

## Conflictos y concurrencia

- no se permiten actividades incompatibles solapadas para la misma persona;
- las mutaciones usan `FOR UPDATE`, versión optimista e idempotencia;
- iniciar/completar/cancelar dos veces no crea efectos duplicados;
- una actividad final no puede reiniciarse.

## Jornada

Segmentos base:

- 07:00–12:00;
- 13:40–17:30.

La vista Día se presenta en cinco slots:

- 07:00–09:00;
- 09:00–11:00;
- 11:00–12:00;
- 13:40–15:40;
- 15:40–17:30.

## Festivos

El calendario se persiste por fecha/año para permitir actualizaciones legales sin redeploy del frontend. Para 2026 se contempla la Ley 51 de 1983 y la Ley 2578 de 2026, que incorporó el 9 de julio y trasladó el descanso de 2026 al lunes 13 de julio.

Fuentes de referencia:

- Cancillería / Ley 51 de 1983.
- Ministerio del Interior, 5 de junio de 2026, Ley 2578 de 2026.

## Evidencias

Application usa un `EvidenceStoragePort`. El proveedor devuelve una referencia; PostgreSQL conserva:

- actividad;
- usuario;
- tipo;
- proveedor;
- referencia;
- MIME/tamaño;
- fecha;
- metadata.

La precondición de foto para cierre se valida en backend/RPC según la política del catálogo.

## Semáforo

La métrica derivada no depende de colores:

- `NORMAL`;
- `OVER_60_MINUTES`.

La UI decide la presentación visual y siempre acompaña el color con texto/estado.

## Integración futura Orders → Workforce

El contrato admite `source = ORDER_EVENT`, `order_id` y `order_task_id`. Este hilo no crea el consumidor automático de eventos.

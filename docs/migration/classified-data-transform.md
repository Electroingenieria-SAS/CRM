# Hilo 15 — transformación de datos clasificados

## Alcance

Este bloque completa la cobertura de datasets ya clasificados en Hilo 15 que no estaban incluidos en el rehearsal operativo inicial.

### Inventario

- `inventory_lots` + reservas siguen definiendo el **opening balance** del CRM nuevo.
- `inventory_movements` legacy se conserva como historial trazable con `historicalOnly=true`.
- Los movimientos históricos **no se reproducen** contra el balance de apertura; hacerlo duplicaría sus efectos.
- Tipos legacy conocidos:
  - `RECEIPT` y `CUT_REEL_ENTRY` → `RECEIPT`;
  - `ISSUE` y `CUT_CONSUMPTION` → `CONSUME`.
- El tipo original, ubicaciones y metadatos quedan en `metadata`.
- Un tipo legacy no mapeado bloquea `source-compatibility.sql`.

### Workforce

- Cada miembro de una asignación legacy se transforma en una actividad target.
- Las ejecuciones manuales sin asignación se transforman en actividades manuales.
- Todas las ejecuciones se preservan adicionalmente como eventos idempotentes
  `legacy-execution:<id>`.
- Mapeo de estados:
  - `PLANNED` → `PLANNED`;
  - `WAITING_EVIDENCE` / `IN_PROGRESS` → `IN_PROGRESS`;
  - `PAUSED` → `BLOCKED`;
  - `COMPLETED` → `COMPLETED`;
  - `CANCELLED` → `CANCELLED`.
- Evidencias se religan a la actividad derivada del miembro o de la ejecución manual.
- El estado, métricas de tiempo y relaciones legacy permanecen en metadata/eventos.

### Auditoría

- El target recibe la ventana de los últimos 30 días respecto al evento más reciente del source.
- Además siempre se conservan acciones con prefijos `AUTH_`, `ADMIN_` y `APPROVAL_`.
- El resto permanece en el archivo/source legacy y no se copia al ledger operacional nuevo.
- Payloads potencialmente sensibles no se copian al target; se marca
  `legacyPayloadRedacted=true`.
- Eventos con organización nula se asignan a la organización primaria del source y quedan
  marcados con `legacyOrganizationMissing=true`.

## Rehearsal real

El gate manual con `MIGRATION_SOURCE_DB_URL` ejecuta:

`pg_dump → restore efímero → compatibility gate → snapshot source/clone → staging → transformación → validación → reconciliación → reconciliación de pedidos activos`.

El dump es temporal, no se publica como artifact y se destruye al terminar el job.

## Criterio de aprobación

El bloque puede integrarse al release maestro únicamente cuando:

1. `Migration transform rehearsal` esté verde;
2. `Migration dry-run` esté verde;
3. el segundo pase sintético mantenga los mismos conteos (idempotencia);
4. no exista ningún finding bloqueante de compatibilidad;
5. el PR permanezca sin tocar producción.

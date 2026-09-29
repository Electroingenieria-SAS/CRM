# Importaciones históricas de Analytics

## Contrato soportado

`ORDER_STAGE_HISTORY_V1` acepta CSV de hasta 10 MB y 2.000 filas por lote.

Encabezados:

- externalKey;
- externalOrderKey;
- orderNumber;
- clientName;
- sellerReference;
- routeCode;
- stepCode;
- taskCreatedAt;
- startedAt;
- completedAt;
- waitingSeconds;
- processingSeconds;
- blockedSeconds;
- transitSeconds.

## Flujo

```
CSV
 -> SHA-256
 -> validación
 -> analytics_import_batches
 -> analytics_import_rows
 -> preview
 -> aplicación de filas válidas
 -> analytics_historical_stage_events
```

No se inserta directamente en Orders, Workforce, Freight, Inventory, Finance o Logistics.

## Idempotencia

Dos fronteras evitan duplicados:

1. `organization_id + import_type + checksum_sha256` evita reprocesar el mismo archivo;
2. `organization_id + source + external_key` evita duplicar una fila histórica desde la misma
   fuente.

Una repetición retorna el lote existente en lugar de duplicar datos.

## Política parcial

La política es `VALID_ROWS_PLUS_REJECTED_REPORT`.

Las filas válidas se pueden aplicar aunque otras fallen. Cada fila inválida conserva:

- número de fila;
- campo;
- código;
- causa.

Las filas ya existentes se marcan como rechazadas con `ALREADY_IMPORTED`.

## Trazabilidad

Cada lote registra:

- archivo;
- checksum;
- tamaño;
- tipo;
- fuente;
- usuario;
- fecha;
- total;
- válidas;
- aplicadas;
- rechazadas;
- estado final.

La tabla histórica conserva además `import_batch_id` y el número de fila.

## Seguridad

Solo `imports.create` puede preparar/aplicar. Lectura usa RLS por organización.

El navegador no recibe credenciales privilegiadas y no existe endpoint para volcar toda la base.

## Datos existentes

Antes de crear un nuevo import type se debe comprobar si el dominio propietario ya incorporó el
histórico. En particular, Freight mantiene su propio histórico y no debe duplicarse mediante este
contrato.

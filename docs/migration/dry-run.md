# Hilo 15 — Procedimiento de dry-run

## Objetivo

Ensayar la migración completa fuera de producción, sin infraestructura persistente de pago, y producir evidencia repetible de duración, filas, errores y reconciliación.

## Requisitos

- PostgreSQL/Supabase local efímero aislado;
- dump reciente verificado;
- migraciones del CRM nuevo en el SHA candidato;
- secretos de origen protegidos cuando sea necesario extraer un dump real; nunca en Git;
- datos reales minimizados o acceso restringido.

## Secuencia

1. Crear/restablecer un destino local efímero vacío en CI o entorno aislado.
2. Aplicar todas las migraciones del CRM nuevo.
3. Restaurar el dump lógico autorizado o ejecutar el importador de migración sobre ese destino efímero.
4. Ejecutar `scripts/migration/validate-critical.sql`.
5. Capturar snapshot con `scripts/migration/snapshot.sql`.
6. Ejecutar `scripts/migration/reconcile.sh` entre origen y destino.
7. Ejecutar smoke únicamente sobre datos migrados/restaurados en el entorno efímero.
8. Registrar duración, filas, errores, warnings y diferencias justificadas.
9. Repetir el mismo proceso una segunda vez cuando se esté validando idempotencia de importadores; nunca duplicar entidades.

## Criterios bloqueantes

- huérfanos referenciales;
- diferencia monetaria no explicada;
- stock/reservas negativos o agregados distintos;
- pedidos activos ausentes o en etapa/responsable incorrectos;
- usuario/perfil/rol sin correspondencia;
- cross-tenant/RLS roto.

## Evidencia mínima

Guardar fuera de Git cualquier dump o dato sensible. En Git solo se registran:

- SHA de aplicación;
- timestamps;
- conteos agregados;
- checksums no reversibles;
- resultado PASS/FAIL;
- diferencias justificadas.


## Restricción de costo

Este procedimiento es **Free-only**. Un branch Supabase Pro o un proyecto QA persistente no es requisito de aprobación. El criterio es aislamiento + repetibilidad + restore/import real + reconciliación, no la existencia de infraestructura remota permanente.

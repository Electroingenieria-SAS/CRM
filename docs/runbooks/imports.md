# Runbook — Importaciones

1. Validar CSV y preview antes de aplicar.
2. No superar límites de tamaño/filas definidos por contrato.
3. Confirmar fuente, checksum e idempotencia.
4. Aplicar una sola vez; retries deben reutilizar el batch.
5. Si queda `FAILED`, revisar `result` y telemetría; no editar filas importadas manualmente para “forzar” éxito.
6. Si queda `APPLYING`, detener nuevas aplicaciones del mismo origen hasta diagnosticar.
7. Antes de una importación masiva de producción, generar backup lógico reciente.

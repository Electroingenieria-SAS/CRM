# ADR-0003 · Freight Intelligence robusto y explicable

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto

El CRM fuente evolucionó desde un estimador por ruta hacia un modelo ridge con 749 despachos reales y posteriormente a un fallback geográfico. La versión 11.40 podía devolver falsos estados de histórico insuficiente cuando la combinación transportadora + ciudad + departamento no coincidía exactamente o faltaba peso para una ruta no reconocida. La 11.42 corrigió parte del problema mediante normalización y fallback ciudad → departamento → nacional.

## Decisión

Se adopta FREIGHT_ROBUST_V1:

1. El histórico legado se conserva como 166 agregados sanitizados que representan 749 despachos reales entre 2026-01-06 y 2026-09-23.
2. Los destinos se normalizan por ciudad/departamento y las transportadoras usan UUID y códigos estables.
3. El fallback es estrictamente ciudad → departamento → nacional, dentro de modalidad y transportadora compatibles.
4. Los nuevos costos reales se almacenan como observaciones independientes de las predicciones.
5. Para observaciones nuevas, los outliers se excluyen mediante IQR 1,5×; se conservan media, P25, P50, P75, P90 e IQR como diagnóstico.
6. La base histórica usa P20/P50/P80 ya calculados; no se inventan percentiles ausentes.
7. La recencia pondera la evidencia.
8. Peso, bultos o volumen solo refinan la estimación con al menos 8 observaciones pareadas y |correlación| ≥ 0,50.
9. Cada predicción guarda versión, fallback, evidencia, muestras, rango, diagnóstico y fuente temporal.
10. CLIENT_PICKUP y CLIENT_POINT devuelven NOT_APPLICABLE; no se inventa costo.
11. Las RPC públicas son SECURITY INVOKER; RLS y RBAC son la autoridad.

## Evidencia histórica auditada

- 749 despachos agregados.
- 166 rutas/transportadora/destino.
- 83 ciudades.
- 24 departamentos.
- 3 transportadoras: COLVANES, TCC y VELOENVIOS.
- Origen histórico: Tuluá.
- Armenia: 9 muestras agregadas (5 COLVANES, 1 TCC y 3 VELOENVIOS).

El rango conceptual de $17.000–$22.000 no se codifica; la aplicación muestra los valores soportados por el histórico real.

## Consecuencias

- Resultado explicable y reproducible.
- Histórico insuficiente solo después de agotar los tres niveles de fallback compatibles.
- Nuevos costos reales permiten MAE, MAPE y sesgo sin sobrescribir la predicción original.
- Versionado permite comparar futuros algoritmos.
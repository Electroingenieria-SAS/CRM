# Matriz del dominio Freight Intelligence

Corte: 2026-09-28.

| ID      | Prioridad | Área        | Hallazgo / requisito                                    | Evidencia / acción                                             | Estado       |
| ------- | --------- | ----------- | ------------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| FRT-001 | P0        | Histórico   | Falso histórico insuficiente por coincidencia estricta. | Normalización + fallback CITY → DEPARTMENT → NATIONAL y pgTAP. | Implementado |
| FRT-002 | P0        | Integridad  | Predicción y costo real separados.                      | predictions + observations + outcomes.                         | Implementado |
| FRT-003 | P0        | Seguridad   | Aislamiento organizacional y autorización.              | RLS + pruebas positivas/negativas + RPC invoker.               | Implementado |
| FRT-004 | P1        | Estadística | Outliers no deben distorsionar.                         | IQR 1,5×; legado P20/P50/P80.                                  | Implementado |
| FRT-005 | P1        | Recencia    | Tarifas antiguas no pesan igual.                        | Ponderación por recencia + unit tests.                         | Implementado |
| FRT-006 | P1        | Variables   | Peso/bultos/volumen no se fuerzan.                      | Regresión solo con ≥8 pares y correlación absoluta ≥ 0,50.     | Implementado |
| FRT-007 | P1        | UI          | Resultado explicable y responsive.                      | Tarjetas, rango, evidencia, fallback, histórico paginado.      | Implementado |
| FRT-008 | P1        | Aprendizaje | Costos reales deben alimentar evaluación.               | recordActual + outcomes MAE/MAPE/sesgo.                        | Implementado |
| FRT-009 | P1        | QA          | Recorrido autenticado.                                  | Playwright seller/auditor + Armenia; E2E autenticado verde.    | Validado     |
| FRT-010 | P1        | CI          | No merge con gates rojos.                               | PR #9 y pipeline de `main` completos en verde; deploy exitoso. | Validado     |

## Paridad funcional

| Capacidad                             | Fuente  | Nuevo CRM | Prueba       |
| ------------------------------------- | :-----: | :-------: | ------------ |
| Histórico real agregado               |    ✓    |     ✓     | seed + pgTAP |
| Destinos normalizados                 |    ✓    |     ✓     | unit + DB    |
| Fallback ciudad/departamento/nacional |    ✓    |     ✓     | pgTAP        |
| Estimación central + rango            |    ✓    |     ✓     | pgTAP + E2E  |
| Evidencia y muestras                  | parcial |     ✓     | DB + UI      |
| Outliers                              | parcial |     ✓     | unit + DB    |
| Recencia                              | parcial |     ✓     | unit + DB    |
| Predicción vs costo real              | parcial |     ✓     | pgTAP        |
| Métricas MAE/MAPE/sesgo               | parcial |     ✓     | DB           |
| UI responsive                         |    ✓    |     ✓     | E2E          |

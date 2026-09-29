# Catálogo de KPIs

El catálogo ejecutable vive en `erp_supply.analytics_kpi_catalog`; este documento explica su
semántica estable. La UI no debe redefinir estas fórmulas.

| KPI                 | Definición                                          | Fuente                           | Rango/filtros                                                | Limitación                         |
| ------------------- | --------------------------------------------------- | -------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| ORDERS_TOTAL        | Pedidos creados dentro del rango                    | orders.created_at                | fecha, cliente, vendedor, etapa, estado, modalidad, segmento | no representa backlog anterior     |
| ORDERS_ACTIVE       | Pedidos activos que intersectan el rango            | orders                           | mismos filtros operativos                                    | excluye CLOSED/CANCELLED           |
| ORDERS_CLOSED       | Pedidos cerrados dentro del rango                   | orders.closed_at                 | fecha y filtros operativos                                   | requiere closed_at confiable       |
| ORDERS_BLOCKED      | Pedido BLOCKED o con bloqueo abierto                | orders + order_blocks            | fecha y filtros operativos                                   | evidencia estado, no culpabilidad  |
| FINANCIAL_PENDING   | Pedido actualmente en CARTERA/CAJA/CAJA_FACTURACION | orders.current_step_code         | fecha y filtros operativos                                   | no sustituye contabilidad          |
| WORKFORCE_OCCUPIED  | Personas ocupadas/bloqueadas                        | erp_x_order_workforce_indicators | fecha                                                        | respeta exclusiones configuradas   |
| WORKFORCE_AVAILABLE | Personas disponibles                                | erp_x_order_workforce_indicators | fecha                                                        | respeta jornada                    |
| DELIVERIES_PENDING  | Pedidos activos en etapa de entrega                 | orders; Logistics cuando exista  | fecha, cliente, modalidad                                    | pre-Logistics es cola por etapa    |
| VSM_LEAD_TIME       | Tiempo laboral creación -> cierre/corte             | workforce_business_seconds       | pedido                                                       | no es processing time              |
| VSM_WAITING_TIME    | Creación de etapa -> inicio                         | order_tasks                      | etapa/rango                                                  | cero solo si inició inmediatamente |
| VSM_PROCESSING_TIME | Tiempo iniciado menos bloqueo explícito             | order_tasks + order_blocks       | etapa/rango                                                  | no usar closed_at-created_at       |
| VSM_BLOCKED_TIME    | Intervalos de bloqueo explícitos                    | order_blocks                     | etapa/rango                                                  | depende de bloqueo trazado         |

## Reglas temporales

La organización define su zona horaria. Para EI la zona es `America/Bogota`.

Los rangos de fecha son inclusivos en calendario local y se convierten a:

- inicio: `from 00:00` local;
- fin exclusivo: `to + 1 día 00:00` local.

VSM usa `erp_private.workforce_business_seconds`, por lo que fines de semana, festivos y franjas
no laborables siguen la definición oficial de Workforce.

## VSM

`lead time` describe el ciclo completo del pedido.

Por etapa:

- `waiting time`: tarea creada hasta inicio;
- `processing time`: tiempo laboral desde inicio hasta fin/corte, menos bloqueos;
- `blocked time`: intervalos de bloqueo;
- `transit time`: solo cuando una fuente explícita lo provee;
- `total time`: ciclo total de la etapa.

Nunca usar `closed_at - created_at` como “tiempo productivo”.

Los agregados incluyen promedio, mediana, P75, P90 y P95. Los cuellos de botella muestran
espera, P90, cola, muestras y bloqueos; no asignan causalidad a personas.

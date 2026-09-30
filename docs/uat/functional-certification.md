# UAT empresarial y certificación funcional — Hilo 14

Estado: **CERTIFICACIÓN FUNCIONAL APROBADA**  
Base certificada: `main@3738b91b703206cb3ece353ea7c2d9ae4651623a` (Hilo 13 / integración global).

## Criterio

Hilo 14 no reconstruye dominios. La certificación combina journeys empresariales representativos con la cobertura técnica ya existente de pgTAP, RLS, concurrencia y E2E por dominio. Un escenario solo se considera aprobado cuando el gate final de esta rama está verde.

| ID       | Escenario                                  | Rol principal                         | Resultado esperado                                                               | Evidencia automatizada                        | Estado   | Corrección |
| -------- | ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- | -------- | ---------- |
| UAT14-01 | Alta PVC / CASH / CLIENT_POINT             | Ventas                                | Pedido creado, prioridad automática, trazabilidad                                | `uat-enterprise-certification.spec.ts`        | APROBADO | —          |
| UAT14-02 | Alta PVN / CASH / NATIONAL_DISPATCH        | Ventas                                | Pedido nacional creado y enrutable                                               | UAT + Logistics/Freight E2E                   | APROBADO | —          |
| UAT14-03 | Alta PVE con compra                        | Ventas / Compras                      | Pedido requiere abastecimiento y Supply lo soporta                               | UAT + `supply.spec.ts`                        | APROBADO | —          |
| UAT14-04 | Alta PVP / CREDIT / CLIENT_PICKUP          | Ventas / Finanzas                     | Pedido PVP creado; Cartera solo si existe mora marcada y Billing exige Anexo PVP | UAT + Finance/Billing E2E                     | APROBADO | —          |
| UAT14-05 | Crédito → Cartera → excepción → Caja       | Ventas/Cartera/Gerencia/Caja          | Segregación, retención, aprobación y pago trazables                              | `authenticated-finance.spec.ts` + concurrency | APROBADO | —          |
| UAT14-06 | Recepción → reserva → picking → corte      | Recepción/Logística/Corte             | Inventory conserva stock, reserva, sobrante y desperdicio                        | Supply + Inventory E2E/pgTAP                  | APROBADO | —          |
| UAT14-07 | Orders → Workforce                         | Operación                             | Una sola actividad, ocupación y evidencia coherentes                             | Orders↔Workforce E2E + concurrency            | APROBADO | —          |
| UAT14-08 | Facturación → Freight → despacho → entrega | Caja/Coordinación                     | Gate financiero, estimación, costo real, guía, evidencia y cierre                | `authenticated-logistics.spec.ts`             | APROBADO | —          |
| UAT14-09 | Dashboard/VSM/reportes                     | Superadmin                            | KPIs y tiempos separados con datos sintéticos                                    | `analytics.spec.ts`                           | APROBADO | —          |
| UAT14-10 | PACO + Auditoría + Admin                   | Superadmin/Auditoría                  | PACO respeta RBAC y operaciones críticas quedan auditadas                        | `admin-audit-paco.spec.ts`                    | APROBADO | —          |
| UAT14-11 | Segregación visible de roles               | Ventas/Auditor/Coordinador/Superadmin | Cada rol expone únicamente superficies autorizadas                               | UAT representativa + RLS pgTAP                | APROBADO | —          |
| UAT14-12 | Concurrencia crítica                       | múltiples                             | Sin doble claim, pago, reserva, actividad o despacho                             | scripts `tests/integration/*concurrency*`     | APROBADO | —          |
| UAT14-13 | Móvil operativo                            | operación                             | Customer, Workforce y Logistics sin overflow crítico                             | targeted mobile smoke                         | APROBADO | —          |
| UAT14-14 | Cross-tenant                               | Organización A/B                      | A no puede leer ni mutar B                                                       | pgTAP RLS por dominio                         | APROBADO | —          |

## Reglas empresariales certificadas

- Prioridad de cliente: cantidad de pedidos + valor efectivamente pagado; pago proviene de facturas registradas netas de reversos.
- Jornada Workforce: lunes a viernes, 07:00–12:00 y 13:40–17:30; fines de semana y festivos fuera de tiempo laboral.
- Prioridad de Orders no es manual.
- PVE puede requerir abastecimiento.
- PVC/PVP pasan por Cartera cuando existe mora marcada; PVN pasa por Caja cuando existe retención, conforme al flujo legado certificado.
- Facturación/logística no puede saltarse bloqueos financieros.
- Freight conserva estimación separada del costo real.
- Evidencia obligatoria se valida en backend.
- PACO no eleva privilegios.
- Auditoría es de solo lectura para el rol Auditoría y conserva eventos críticos.

## Clasificación de resultados

- **APROBADO:** comportamiento esperado y evidencia verde.
- **HALLAZGO:** desviación reproducible no bloqueante.
- **BLOQUEANTE:** impide flujo crítico o compromete seguridad/integridad.
- **CORRECCIÓN REQUERIDA:** causa raíz y regresión concreta que debe cerrarse antes de Hilo 15.

## Pendientes externos de release

No son fallos UAT por sí mismos: ruleset/branch protection, hardening coordinado de `erp-auditoria-metrics`, Leaked Password Protection condicionado por plan, proyecto Vercel definitivo y restore real en entorno no productivo. Se transfieren al Hilo 15 si la UAT termina sin bloqueantes.

## Resultado final

- Escenarios certificados: **14**
- Aprobados: **14**
- Hallazgos funcionales abiertos: **0**
- Bloqueantes: **0**
- Correcciones funcionales pendientes: **0**
- Routing comercial PVC/PVN/PVE/PVP: **APROBADO**
- RLS/RBAC y aislamiento cross-tenant: **APROBADO**
- Concurrencia crítica: **APROBADO**
- Full-domain authenticated regression: **APROBADO**
- Enterprise UAT representative journeys: **APROBADO**
- Targeted mobile integration smoke: **APROBADO**
- Quality / build / arquitectura: **APROBADO**
- Database / pgTAP / RLS: **APROBADO**
- CodeQL / secretos / supply-chain: **APROBADO**

La única corrección durante la campaña fue documental: normalización de formato Markdown para satisfacer Prettier. No se descubrió ninguna regresión funcional, de seguridad o de integridad que requiriera modificar dominios cerrados.

## Decisión

**APTO PARA HILO 15 — MIGRACIÓN + PUESTA EN PRODUCCIÓN CONTROLADA**

Los pendientes externos de release indicados arriba deben resolverse o aceptarse explícitamente durante Hilo 15 antes del cutover productivo.

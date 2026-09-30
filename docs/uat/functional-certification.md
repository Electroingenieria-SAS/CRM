# UAT empresarial y certificación funcional — Hilo 14

Estado: **en ejecución sobre staging sintético**  
Base certificada: `main@3738b91b703206cb3ece353ea7c2d9ae4651623a` (Hilo 13 / integración global).

## Criterio

Hilo 14 no reconstruye dominios. La certificación combina journeys empresariales representativos con la cobertura técnica ya existente de pgTAP, RLS, concurrencia y E2E por dominio. Un escenario solo se considera aprobado cuando el gate final de esta rama está verde.

| ID       | Escenario                                  | Rol principal                         | Resultado esperado                                                               | Evidencia automatizada                        | Estado                     | Corrección |
| -------- | ------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------- | ---------- |
| UAT14-01 | Alta PVC / CASH / CLIENT_POINT             | Ventas                                | Pedido creado, prioridad automática, trazabilidad                                | `uat-enterprise-certification.spec.ts`        | APROBADO condicionado a CI | —          |
| UAT14-02 | Alta PVN / CASH / NATIONAL_DISPATCH        | Ventas                                | Pedido nacional creado y enrutable                                               | UAT + Logistics/Freight E2E                   | APROBADO condicionado a CI | —          |
| UAT14-03 | Alta PVE con compra                        | Ventas / Compras                      | Pedido requiere abastecimiento y Supply lo soporta                               | UAT + `supply.spec.ts`                        | APROBADO condicionado a CI | —          |
| UAT14-04 | Alta PVP / CREDIT / CLIENT_PICKUP          | Ventas / Finanzas                     | Pedido PVP creado; Cartera solo si existe mora marcada y Billing exige Anexo PVP | UAT + Finance/Billing E2E                     | APROBADO condicionado a CI | —          |
| UAT14-05 | Crédito → Cartera → excepción → Caja       | Ventas/Cartera/Gerencia/Caja          | Segregación, retención, aprobación y pago trazables                              | `authenticated-finance.spec.ts` + concurrency | APROBADO condicionado a CI | —          |
| UAT14-06 | Recepción → reserva → picking → corte      | Recepción/Logística/Corte             | Inventory conserva stock, reserva, sobrante y desperdicio                        | Supply + Inventory E2E/pgTAP                  | APROBADO condicionado a CI | —          |
| UAT14-07 | Orders → Workforce                         | Operación                             | Una sola actividad, ocupación y evidencia coherentes                             | Orders↔Workforce E2E + concurrency            | APROBADO condicionado a CI | —          |
| UAT14-08 | Facturación → Freight → despacho → entrega | Caja/Coordinación                     | Gate financiero, estimación, costo real, guía, evidencia y cierre                | `authenticated-logistics.spec.ts`             | APROBADO condicionado a CI | —          |
| UAT14-09 | Dashboard/VSM/reportes                     | Superadmin                            | KPIs y tiempos separados con datos sintéticos                                    | `analytics.spec.ts`                           | APROBADO condicionado a CI | —          |
| UAT14-10 | PACO + Auditoría + Admin                   | Superadmin/Auditoría                  | PACO respeta RBAC y operaciones críticas quedan auditadas                        | `admin-audit-paco.spec.ts`                    | APROBADO condicionado a CI | —          |
| UAT14-11 | Segregación visible de roles               | Ventas/Auditor/Coordinador/Superadmin | Cada rol expone únicamente superficies autorizadas                               | UAT representativa + RLS pgTAP                | APROBADO condicionado a CI | —          |
| UAT14-12 | Concurrencia crítica                       | múltiples                             | Sin doble claim, pago, reserva, actividad o despacho                             | scripts `tests/integration/*concurrency*`     | APROBADO condicionado a CI | —          |
| UAT14-13 | Móvil operativo                            | operación                             | Customer, Workforce y Logistics sin overflow crítico                             | targeted mobile smoke                         | APROBADO condicionado a CI | —          |
| UAT14-14 | Cross-tenant                               | Organización A/B                      | A no puede leer ni mutar B                                                       | pgTAP RLS por dominio                         | APROBADO condicionado a CI | —          |

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

## Gate de salida

La decisión final solo puede ser **APTO PARA HILO 15** cuando el pipeline final esté verde y no exista ningún bloqueante funcional, de seguridad o integridad descubierto por estos escenarios.

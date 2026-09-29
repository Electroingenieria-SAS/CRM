# Matriz Workforce / Jornada / Cronograma

Corte: 2026-09-28.

| ID     | Prioridad | Área          | Requisito / riesgo                                             | Implementación                                                            | Evidencia                          | Estado           |
| ------ | --------- | ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- | ---------------- |
| WF-001 | P0        | Jornada       | Excluir almuerzo, fines de semana y festivos.                  | Segmentos 07:00–12:00 y 13:40–17:30 + calendario versionado.              | pgTAP 005.                         | Implementado     |
| WF-002 | P0        | Planificación | Evitar solapamientos silenciosos por responsable.              | EXCLUDE GIST sobre rango planificado y perfil.                            | pgTAP 006.                         | Implementado     |
| WF-003 | P0        | Concurrencia  | Evitar doble inicio/cierre y estados contradictorios.          | FOR UPDATE + version optimista + locks de idempotencia.                   | pgTAP + workforce-concurrency.mjs. | Implementado     |
| WF-004 | P0        | Evidencia     | Cierre operativo no debe depender de un flag frontend.         | Política de evidencia en catálogo + validación RPC.                       | pgTAP 006 + E2E.                   | Implementado     |
| WF-005 | P0        | RLS/BOLA      | Otra organización no puede leer o enlazar datos ajenos.        | RLS por organization_id + validación de referencias catalog/order/task.   | pgTAP 006.                         | Implementado     |
| WF-006 | P1        | Catálogo      | Categoría → subcategoría → actividad específica administrable. | Catálogo persistido y seed de paridad legado.                             | RPC catalog + UI.                  | Implementado     |
| WF-007 | P1        | Día           | Cinco franjas deben coincidir exactamente con encabezados.     | Grid 1 columna de equipo + 5 slots; cards móviles.                        | Unit + E2E responsive.             | Implementado     |
| WF-008 | P1        | Semana/Mes    | Mostrar días laborales y resumen legible.                      | Semana L–V; Mes resumido con detalle por actividad.                       | E2E.                               | Implementado     |
| WF-009 | P1        | Ocupación     | No inferir ocupación por mera existencia de actividad.         | AVAILABLE/OCCUPIED/BLOCKED/OUT_OF_SCHEDULE derivados por tiempo y estado. | Unit + DB.                         | Implementado     |
| WF-010 | P1        | Semáforo      | >1 h debe ser semántico y no solo un color.                    | NORMAL / OVER_60_MINUTES desde ejecución real.                            | Unit + DB + UI.                    | Implementado     |
| WF-011 | P1        | Excepción     | Tratamiento especial no puede depender del nombre.             | workforce_profile_policies por profile_id.                                | pgTAP 006.                         | Implementado     |
| WF-012 | P1        | Storage       | Evidencia binaria desacoplada del dominio.                     | EvidenceStoragePort + bucket privado + firma mágica.                      | Unit + E2E.                        | Implementado     |
| WF-013 | P1        | Rendimiento   | Evitar N+1 por persona/franja y polling.                       | RPC por rango temporal; refresco solo tras eventos.                       | Arquitectura + read API.           | Implementado     |
| WF-014 | P1        | Mobile/A11Y   | No comprimir tabla desktop; navegación accesible.              | Cards/timeline ≤760px, dialog nativo, labels, focus y touch targets.      | Playwright 320–1920 + iPhone.      | En validación CI |
| WF-015 | P1        | CI            | No fusionar con gates rojos.                                   | workforce.yml aislado + pipeline general del repositorio.                 | Checks del PR.                     | En validación CI |

## Paridad funcional

- Todas las actividades se consultan por organización/rango y no por creador.
- El cierre normal no reconstruye aprobación de jefatura.
- Orders solo se referencia por UUID; Workforce no duplica cliente, dirección ni materiales.
- El contrato futuro Orders → Workforce existe como puerto/evento; la automatización completa queda fuera de este hilo.
- Ninguna migración de este PR se aplicó sobre Supabase productivo.

# Hilo 15 — Readiness de migración y puesta en producción

Corte: 2026-09-30  
Baseline: `main@3738b91b703206cb3ece353ea7c2d9ae4651623a`  
Estado: **NO-GO temporal para cutover**

## Evidencia de entrada

- Hilo 13 está fusionado en `main` (PR #24).
- `main` tiene pipeline principal y Workforce verdes en el último SHA.
- Hilo 14 está certificado y fusionado en `main` (PR #25, merge `b13f934f03a43ea115547e914c67eef3f338cb9b`), con 14/14 escenarios UAT aprobados y cero bloqueantes funcionales.
- No existe ruleset/protección de `main`.
- Supabase productivo legado: `hezjxcxxcjlpmyalftam`, estado `ACTIVE_HEALTHY`, Postgres 17, sin branches.
- Organización Supabase en plan Free: el mecanismo de backup operativo debe ser dump lógico externo; no se declara PITR.
- Vercel no tiene proyecto separado para el CRM nuevo; existe `crm-suministros` y se mantiene como producto legado.
- No existe destino remoto no productivo aprobado para ejecutar restore de un dump real.

## Blockers de GO

| ID      | Bloqueante                                     | Estado                | Criterio de cierre                                                                                                                                     |
| ------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MIG-002 | Restore real no ensayado                       | Abierto               | dump reciente restaurado en destino no productivo y smoke aprobado                                                                                     |
| MIG-003 | Proyecto Vercel nuevo inexistente              | Abierto               | proyecto separado de `crm-suministros`, Preview configurado y smoke aprobado                                                                           |
| MIG-004 | Protección de `main` inexistente               | Abierto               | PR/checks obligatorios y force-push bloqueado                                                                                                          |
| MIG-005 | Edge Function legacy insegura                  | Condicional / aislada | No migrar `erp-auditoria-metrics`; búsqueda runtime sin consumidores. El legado debe quedar aislado/read-only y su retiro se hace en ventana separada. |
| MIG-006 | Ventana/responsable de cutover no documentados | Abierto               | ventana, freeze, responsable y canal de rollback definidos                                                                                             |

## Decisión técnica actual

**NO-GO.** No se ejecutan DDL, importaciones, DNS, cambios de Auth, deploy productivo ni freeze mientras exista cualquiera de MIG-002 o MIG-003.

Este hilo sí puede preparar scripts, mapping, reconciliación, runbooks y Preview no productivo cuando exista el destino.

## Checkpoints

- A Readiness: **completado / Hilo 14 cerrado; NO-GO por infraestructura/restore**
- B Inventario y clasificación: **completado; preflight 15/15 PASS**
- C Backup + restore rehearsal: **bloqueado por destino no productivo**
- D Migración seca: **bloqueado por C**
- E Validación/reconciliación: **scripts ejecutables preparados; baseline origen capturado**
- F Infraestructura: **Vercel/Supabase destino pendientes**
- G Cutover: **no autorizado**
- H Smoke productivo: **no ejecutado**
- I Handoff a Hilo 16: **no procede todavía**

## Evidencia adicional 2026-09-30

- Preflight referencial/inventario del origen: 15/15 PASS.
- Pedido en vuelo: 1, etapa `LOCAL_DISPATCH`, 4 tareas, 1 factura, 1 reserva consumida, 0 entregas.
- Workflow manual de dry-run protegido agregado; requiere secretos de origen/destino y nunca publica dumps.
- Estrategia Auth documentada conforme a la guía vigente de Supabase para migración entre proyectos.

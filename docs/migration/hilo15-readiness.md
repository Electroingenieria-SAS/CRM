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
- Vercel ya tiene proyecto separado `crm` (`prj_MEFvzc4lfeK6aZAtSnw9ue83gWdS`), conectado a `Electroingenieria-SAS/CRM`; Preview y deployment de producción responden `200` en `/login` con CSP/HSTS/noindex/nosniff/frame protections.
- Política de infraestructura: **Free-only**. No se crea staging/branch Supabase de pago. El restore rehearsal debe ejecutarse sobre PostgreSQL/Supabase local efímero en CI o entorno local aislado.

## Blockers de GO

| ID      | Bloqueante                     | Estado                | Criterio de cierre                                                                                                                      |
| ------- | ------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-002 | Restore real no ensayado       | Abierto               | dump reciente restaurado en PostgreSQL/Supabase local efímero aislado y validado; no requiere staging remoto                            |
| MIG-003 | Proyecto Vercel / Preview      | Cerrado               | proyecto `crm` separado, Preview `READY` y smoke público `/login` + headers aprobado                                                    |
| MIG-004 | Gobernanza de `main`           | Mitigado / admin ext. | CODEOWNERS + workflow detectan push directo; protección nativa/ruleset requiere acción administrativa fuera del conector                |
| MIG-005 | Drift `erp-auditoria-metrics`  | Excepción legacy      | no se migra ni usa en CRM nuevo; se mantiene legacy-only/read-only durante coexistencia y se endurece después de identificar consumidor |
| MIG-006 | Ventana/responsable de cutover | Cerrado               | ventana estándar 17:40–19:10 America/Bogota, JEPTAC, freeze/GO/rollback documentados                                                    |
| MIG-007 | Destino Free-only / transición | Abierto               | rehearsal real aprobado + rotación de cupo: freeze → backup → pausar legacy → crear target Free → Auth/datos → Preview/UAT              |

## Decisión técnica actual

**NO-GO temporal.** Los blockers técnicos previos al cutover son MIG-002 y MIG-007. MIG-002 exige restore/transform rehearsal real con copia productiva; MIG-007 exige validar la transición Free-only hacia un proyecto nuevo durante la ventana, porque el Supabase legacy no contiene todavía el modelo target y no se considera ensayada una sustitución in-place. MIG-003 y MIG-006 están cerrados; MIG-004 queda mitigado técnicamente y requiere la activación administrativa nativa de GitHub; MIG-005 queda aislado como excepción legacy no usada por el CRM nuevo.

Este hilo sí puede preparar scripts, mapping, reconciliación, runbooks y Preview no productivo cuando exista el destino.

## Checkpoints

- A Readiness: **completado / Hilo 14 cerrado; NO-GO por infraestructura/restore**
- B Inventario y clasificación: **completado; preflight 15/15 PASS**
- C Backup + restore rehearsal: **pendiente de restore real en entorno local efímero gratuito**
- D Migración seca: **puede ejecutarse sobre destino local efímero después de C; no requiere Supabase remoto**
- E Validación/reconciliación: **scripts ejecutables preparados; baseline origen capturado**
- F Infraestructura: **Vercel listo; estrategia Supabase Free-only definida, sin staging remoto**
- G Cutover: **ventana/owner/rollback definidos; pendiente de MIG-002 + MIG-007 + CI final**
- H Smoke productivo: **no ejecutado**
- I Handoff a Hilo 16: **preparado; procede después de freeze/cutover y baseline final**

## Evidencia adicional 2026-09-30

- Preflight referencial/inventario del origen: 15/15 PASS.
- Pedido en vuelo: 1, etapa `LOCAL_DISPATCH`, 4 tareas, 1 factura, 1 reserva consumida, 0 entregas.
- Workflow manual de dry-run protegido agregado; requiere secretos de origen/destino y nunca publica dumps.
- La reconciliación remota deja de ser requisito del rehearsal. La comparación previa al cutover se hará contra el destino real únicamente cuando corresponda; antes de eso, restore/import/reconciliación se ensayan en entorno local efímero.
- `erp-auditoria-metrics` presenta drift entre código y deployment: el repositorio legado exige JWT y CORS allowlist, pero la versión productiva activa continúa pública. Se observó tráfico real exitoso sin Authorization en las últimas 24 h, por lo que el cambio debe hacerse mediante ventana de compatibilidad, no por retiro abrupto.
- Estrategia Auth documentada conforme a la guía vigente de Supabase para migración entre proyectos.

## Evidencia Vercel 2026-09-30

- Proyecto nuevo: `crm` (`prj_MEFvzc4lfeK6aZAtSnw9ue83gWdS`), separado de `crm-suministros`.
- Preview observado `READY`: `dpl_AeRc32tEQBjV9snYTgpJhYCpeLXB`, branch `release/hilo15-controlled-production-migration`.
- Deployment marcado production observado `READY`: `dpl_6JcwTpVkuarku2nb2Wueh1MwRNSX`.
- Preview y alias productivo respondieron HTTP 200 en `/login`.
- Headers verificados: CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy y noindex.
- Vercel Runtime Errors: sin clusters reportados en la ventana observada.
- Esta evidencia valida la superficie web, pero **no sustituye el restore/reconciliación de datos ni prueba por sí sola el cutover Supabase**.

- GitHub branch protection endpoint: 403 `Resource not accessible by integration`; no se reintenta desde este hilo.

## Intentos de staging Supabase

- Proyecto nuevo `crm-reconstruction-staging`: costo reportado **USD 0/mes**; creación rechazada porque un miembro administrador ya alcanzó el límite de **2 proyectos Free activos**.
- Development Branch `hilo15-migration-rehearsal`: costo reportado **USD 0,01344/h**; creación rechazada porque Supabase Branching requiere plan **Pro o superior**.
- Decisión: no pausar/eliminar proyectos desconocidos y no subir de plan desde este hilo. Se usa Supabase local efímero en CI como rehearsal estructural; el restore con copia productiva sigue requiriendo un destino remoto o una credencial protegida para dump + restore aislado.

## Política Free-only

- El proyecto no subirá a planes pagos para staging, branching, PITR o ambientes temporales.
- No se creará un segundo Supabase persistente solo para QA.
- Los rehearsals de schema, restore, importación y validación se ejecutan con Supabase/PostgreSQL local efímero en CI o entorno local aislado.
- Dumps y datos sensibles nunca se publican como artifacts ni se guardan en Git.
- La estrategia preferida usa rotación de cupo: después del backup/freeze se pausa el legacy para liberar un cupo Free y crear el target nuevo; el legacy permanece pausado como rollback inicial.
- Si una capacidad exige plan Pro o costo recurrente, se reemplaza por una alternativa reproducible gratuita o se documenta como no adoptada.

## Gobernanza y ownership

- `.github/CODEOWNERS` asigna ownership de superficies sensibles de release, Supabase, migraciones y workflows a `@JEPTAC`.
- `.github/workflows/main-governance.yml` marca como error cualquier push a `main` sin PR asociado.
- La protección nativa/ruleset de GitHub no puede configurarse desde el conector disponible aunque la cuenta tenga permisos admin; se mantiene como acción administrativa explícita y no se falsea como aplicada.

## Cutover operativo

- Ventana estándar: primer día hábil aprobado después de CI verde, **17:40–19:10 America/Bogota**.
- Responsable técnico: **JEPTAC**.
- Freeze: **17:40**.
- Decisión GO/ROLLBACK: máximo **18:40**.
- Runbook y canal: `docs/release/cutover-window.md` + `docs/runbooks/cutover.md`.

## Excepción legacy

`erp-auditoria-metrics` no forma parte del CRM nuevo. Durante coexistencia permanece legacy-only y monitorizada; su hardening definitivo se ejecuta en un cambio separado después de identificar el consumidor anónimo observado.

## Evidencia de compatibilidad del destino Free-only

Inspección directa del proyecto legacy el 2026-09-30:

- 77 tablas en `erp_supply`;
- 142 funciones en `erp_supply`;
- 168 funciones públicas con referencias explícitas a `erp_supply`;
- tablas target `inventory_balances`, `inventory_reservations`, `logistics_shipments`, `workforce_activities` y `customer_intelligence_scores`: ausentes.

Conclusión: no se autoriza aplicar el CRM nuevo directamente sobre el esquema legacy sin rehearsal específico. La estrategia operativa está definida en `docs/migration/free-slot-cutover.md`.

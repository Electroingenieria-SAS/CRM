# Hilo 15 — Ventana y responsabilidad de cutover

## Ventana operativa

- Zona horaria: `America/Bogota`.
- Ventana estándar: **primer día hábil aprobado después de CI verde, 17:40–19:10**.
- Freeze de escrituras del CRM legado: **17:40**.
- Decisión GO/ROLLBACK: máximo **18:40**.
- Cierre técnico de ventana: **19:10**.
- No iniciar el cutover si el restore rehearsal real y la reconciliación previa no están aprobados.

## Responsabilidad

- Responsable técnico de ejecución: **JEPTAC**.
- Fuente de coordinación: PR de release Hilo 15 + deployments de Vercel.
- Fuente de verdad de datos antes del freeze: Supabase productivo legado.
- Fuente de verdad después del GO: CRM nuevo/Supabase productivo validado.

## Freeze

Durante la ventana:

1. CRM legado pasa a modo mantenimiento/read-only para escrituras operativas.
2. Se captura timestamp de freeze.
3. Se genera backup lógico final y checksum fuera de Git.
4. Se captura snapshot agregado final.
5. No se permite dual-write improvisado.

## Canal de rollback

Rollback se coordina desde:

- PR de release Hilo 15;
- deployment saludable anterior de Vercel;
- CRM legado en read-only como fallback operacional;
- runbook `docs/runbooks/cutover.md`.

## Criterio de cancelación

La ventana se cancela antes de modificar producción si falta cualquiera de:

- backup final + checksum;
- restore rehearsal aprobado;
- reconciliación crítica;
- CI verde;
- artefacto Vercel validado;
- owner disponible para rollback.

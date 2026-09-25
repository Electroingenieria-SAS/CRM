# ADR-0003 — Promoción por etapas

- Estado: Aceptado
- Fecha: 2026-09-25

## Decisión

El primer despliegue del repositorio nuevo es un staging sin datos productivos. Vercel/Supabase productivo se habilitarán solo después de validar P0, E2E autenticado, rollback y paridad del módulo migrado.

## Razón

La auditoría inicial encontró deriva entre configuración versionada y Edge Functions desplegadas. Conectar el nuevo frontend antes de cerrar esa deriva mezclaría reconstrucción con remediación productiva y elevaría el riesgo.

# Runbook — Rollback

## Aplicación

1. Identificar commit/release saludable anterior.
2. Confirmar que el incidente no proviene de una migración irreversible.
3. Revertir el despliegue de aplicación a la release saludable.
4. Ejecutar smoke de login, navegación y módulo afectado.
5. Revisar logs/errores y documentar causa.

## Base de datos

Una migración no se “deshace” automáticamente en producción. Antes de cualquier DDL se documentará estrategia forward-fix o reversión segura, impacto sobre datos y validación posterior. Nunca se ejecuta un rollback destructivo sin respaldo y autorización.

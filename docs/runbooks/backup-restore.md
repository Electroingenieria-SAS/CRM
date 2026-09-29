# Runbook — Backup y restore

## Alcance actual

El proyecto Supabase está en plan Free. La documentación oficial de Supabase indica que los backups diarios restaurables del Dashboard están disponibles para Pro/Team/Enterprise y recomienda a Free realizar exportaciones periódicas con `supabase db dump` y conservarlas fuera del proveedor.

Por tanto, el mecanismo operativo actual es **backup lógico externo**. No se declara PITR ni restore hospedado como disponible.

## Qué se respalda

El job operativo debe generar tres archivos con `scripts/backup-free-plan.sh`:

- `roles.sql`;
- `schema.sql`;
- `data.sql`.

El dump cubre base de datos y Auth que forme parte del dump lógico. No cubre por sí mismo objetos externos de Storage, secretos, variables Vercel/Supabase, OAuth, DNS ni configuración de Edge Functions. Esos elementos se recuperan desde configuración versionada/runbooks y secretos administrados.

## Frecuencia y custodia

- Producción: mínimo diario antes del inicio de la jornada y adicionalmente antes de una migración de riesgo.
- Conservar al menos 7 copias diarias mientras el proyecto permanezca en Free.
- Copiar fuera de Supabase en almacenamiento cifrado con acceso restringido.
- Nunca versionar dumps, URLs de conexión ni credenciales.
- Verificar `SHA256SUMS` antes de usar una copia.

## Restore controlado

Nunca restaurar primero sobre producción. Usar `scripts/restore-nonprod.sh` con una base vacía no productiva y exigir:

```bash
CONFIRM_NON_PRODUCTION=YES_NON_PRODUCTION \
RESTORE_DB_URL='postgresql://...' \
BACKUP_DIR='./backups/<timestamp>' \
./scripts/restore-nonprod.sh
```

Validar como mínimo organizaciones, roles, perfiles, pedidos, RLS/RPC, login sintético y un flujo crítico no destructivo.

## Estado de prueba

La reconstrucción desde base vacía mediante migraciones + seed forma parte del gate de CI. El **restore de un dump productivo real** no se ejecuta desde este hilo porque no existe un destino hospedado no productivo aprobado y usar producción sería inseguro.

Antes de cutover productivo hay dos opciones aceptables:

1. habilitar un entorno no productivo y ejecutar el restore smoke de un dump reciente; o
2. subir Supabase a un plan con backups/restauración y ejecutar un restore controlado allí.

Hasta entonces, el restore hospedado se mantiene como condición operacional de cutover, no como una prueba fingida.

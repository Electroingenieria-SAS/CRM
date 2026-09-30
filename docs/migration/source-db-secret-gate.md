# Gate externo — MIGRATION_SOURCE_DB_URL

Este secreto es el único dato externo requerido para ejecutar el backup/restore rehearsal contra el Supabase legado real.

## Qué contiene

Una cadena PostgreSQL de Supabase obtenida desde **Connect → Session pooler** del proyecto legado `hezjxcxxcjlpmyalftam`, con la contraseña actual de la base de datos.

Formato conceptual:

`postgresql://postgres.<project-ref>:<DB_PASSWORD>@<pooler-host>:5432/postgres`

No copiar un `service_role`, JWT, publishable key ni contraseña a archivos del repositorio.

## Dónde se configura

GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**

Nombre exacto:

`MIGRATION_SOURCE_DB_URL`

El workflow solo la consume en ejecuciones manuales de release que habiliten el rehearsal real.

## Seguridad

- No pegar el valor en issues, PR, chat, logs o documentación.
- No convertirlo en variable `NEXT_PUBLIC_*`.
- No imprimirlo; los workflows aplican masking cuando corresponde.
- Dumps temporales se crean fuera de Git y se eliminan al finalizar.
- El secret puede retirarse de GitHub Actions después de concluir migración/cutover.
- Si la contraseña DB actual no se conoce, cualquier reset debe coordinarse antes porque puede afectar conexiones directas existentes. Este hilo no rota producción automáticamente.

## Criterio de cierre MIG-002

1. secreto configurado;
2. ejecución manual `Migration dry-run` con `execute_source_restore_rehearsal=true`;
3. dump real creado;
4. checksum generado;
5. restore en PostgreSQL/Supabase local efímero;
6. source compatibility PASS;
7. snapshot restaurado = snapshot de origen;
8. pedido(s) activo(s) restaurados = origen;
9. sin dump ni credencial persistente en artifacts/Git.

Solo después de estos puntos se puede declarar probado el backup/restore real.

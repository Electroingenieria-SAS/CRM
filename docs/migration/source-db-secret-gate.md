# Gate externo — MIGRATION_SOURCE_DB_URL

Este secreto es el único dato externo requerido para ejecutar el backup/restore rehearsal contra el Supabase legado real.

## Qué contiene

Una cadena PostgreSQL válida del proyecto legado `hezjxcxxcjlpmyalftam`.

Ruta A — contraseña DB existente:

`postgresql://postgres.<project-ref>:<DB_PASSWORD>@<pooler-host>:5432/postgres`

Ruta B — **Temporary Access** de Supabase, preferida cuando no se conoce la contraseña DB: habilitar acceso temporal para el usuario autorizado, permitirle asumir el rol `postgres` por una ventana corta y usar un PAT de Supabase como credencial PostgreSQL. El valor completo se guarda directamente como `MIGRATION_SOURCE_DB_URL`; el PAT nunca se publica ni se guarda en Git.

El proyecto legacy corre PostgreSQL 17.6 y cumple el requisito de versión para Temporary Access. Esta ruta evita rotar la contraseña productiva y no altera conexiones existentes.

No copiar un `service_role`, JWT de Auth, publishable key, PAT ni contraseña a archivos del repositorio.

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
- Si la contraseña DB actual no se conoce, **no resetearla por defecto**. Preferir Temporary Access con expiración corta y revocación posterior.
- Un reset de contraseña sigue siendo fallback y debe coordinarse porque puede afectar conexiones directas existentes. Este hilo no rota producción automáticamente.
- Probe real 2026-10-01: GitHub Actions no dispone actualmente de `MIGRATION_SOURCE_DB_URL` ni `SUPABASE_ACCESS_TOKEN`; PR auxiliar #35 quedó cerrado sin merge y sin exponer valores.

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

# Entornos y staging

## Producción

Proyecto Supabase: `hezjxcxxcjlpmyalftam`.

Producción no se usa como sandbox. Los cambios DDL permanentes solo se incorporarán después de existir como migraciones versionadas y superar CI.

## Integración sin costo adicional

La organización Supabase está en plan Free y actualmente no tiene branches. La reconstrucción utiliza Supabase local en GitHub Actions:

```text
checkout
→ supabase start
→ supabase db reset
→ migrations
→ synthetic seed
→ pgTAP
→ db lint
→ resto de gates
→ deploy del frontend de staging
```

El esquema operativo `erp_supply` y los helpers `erp_private` no se exponen en la Data API. La configuración local expone únicamente `public`; el acceso funcional ocurre mediante RPC públicas con `SECURITY INVOKER` y RLS.

## Promoción futura

Un cambio de base de datos puede considerarse candidato a producción únicamente cuando:

- el reset desde cero funciona;
- pgTAP pasa;
- RLS tiene pruebas positivas y negativas;
- no aparecen hallazgos nuevos de Security Advisor;
- existe rollback/forward-fix documentado;
- la matriz de paridad identifica el impacto funcional.

## E2E autenticado

El pipeline no almacena contraseñas QA. Para cada ejecución:

1. Supabase local se reconstruye desde cero.
2. GitHub Actions genera una contraseña aleatoria en memoria.
3. La contraseña se pasa a `psql` como variable y el fixture crea usuarios/identidades sintéticos.
4. Next.js recibe únicamente la URL local y la clave publishable local.
5. Playwright prueba login, RBAC, creación, consulta, detalle y logout.
6. El entorno local se destruye al finalizar.

La contraseña efímera y la conexión local nunca se versionan ni se reutilizan.

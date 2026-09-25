# Despliegue

## Staging — GitHub Pages

GitHub Pages publica únicamente el shell estático de reconstrucción. Se construye con `GITHUB_PAGES=true`, `output=export` y `basePath=/CRM`.

No se almacenan secretos en ese entorno y no debe apuntar a producción durante la fase inicial.

## Producción — Vercel

Vercel será el destino de la aplicación completa. La compilación normal no usa `output=export`, por lo que puede habilitar Server Components, Route Handlers y controles server-side cuando sean necesarios.

Antes de producción deben existir:

- P0 cerrados o compensados formalmente;
- CI requerida por ruleset;
- E2E autenticado obligatorio;
- variables de entorno provisionadas fuera de Git;
- CSP productiva probada;
- migración/rollback documentados;
- smoke post-deploy.

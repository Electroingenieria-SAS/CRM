# ADR-0001 — Monolito modular en Next.js

- Estado: Aceptado
- Fecha: 2026-09-25
- Actualización: 2026-09-28

## Contexto

El CRM fuente es una SPA ES Modules funcional pero acumuló módulos y hojas CSS de gran tamaño. La reconstrucción necesita separación por dominio sin asumir el costo operativo de microservicios.

Durante el primer vertical slice autenticado se comprobó que permitir que `src/app` instanciara adaptadores Supabase hacía que la capa de UI conociera detalles de infraestructura.

## Decisión

Usar Next.js 16, App Router y TypeScript estricto como monolito modular. Cada dominio expone contratos explícitos y no accede a Supabase desde su UI.

El runtime de navegador se conecta mediante un composition root explícito en `src/composition/browser-application.ts`. La dirección es:

```text
App/UI → Application contracts
Composition → Application + Infrastructure
Infrastructure → Supabase
```

Application no depende de Infrastructure. La autorización visual consume capacidades entregadas por el contexto de sesión; la base de datos/RLS sigue siendo la autoridad final.

## Consecuencias

- Despliegue único y rollback más simple.
- Fronteras de código comprobables en CI.
- Sustitución del adaptador Supabase sin reescribir componentes.
- Tests unitarios de Auth y Orders sin necesitar SDK externo.
- Posibilidad de Server Components/Route Handlers en Vercel cuando el caso de uso lo requiera.
- GitHub Pages se usa solo como staging visual; no define la arquitectura productiva.

# ADR-0001 — Monolito modular en Next.js

- Estado: Aceptado
- Fecha: 2026-09-25

## Contexto

El CRM fuente es una SPA ES Modules funcional pero acumuló módulos y hojas CSS de gran tamaño. La reconstrucción necesita separación por dominio sin asumir el costo operativo de microservicios.

## Decisión

Usar Next.js 16 Active LTS, App Router y TypeScript estricto como monolito modular. Cada dominio expone contratos explícitos y no accede a Supabase desde su UI.

## Consecuencias

- Despliegue único y rollback más simple.
- Fronteras de código comprobables en CI.
- Posibilidad de Server Components/Route Handlers en Vercel cuando el caso de uso lo requiera.
- GitHub Pages se usa solo como staging estático; no define la arquitectura productiva.

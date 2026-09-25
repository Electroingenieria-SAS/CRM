# CRM — Electroingeniería S.A.S.

Reconstrucción profesional de **CRM Suministros** como monolito modular en Next.js + TypeScript.

> Estado: **staging de reconstrucción**. Este repositorio no está conectado a datos productivos y no debe considerarse sustituto de `CRM-SUMINISTROS` hasta completar la matriz de paridad y los controles P0.

## Línea base funcional

El repositorio histórico `Electroingenieria-SAS/CRM-SUMINISTROS` se usa únicamente como referencia funcional y de auditoría. La línea base congelada para iniciar esta reconstrucción es:

- rama: `main`
- commit: `4bdceeaa54847581f83e9425aa0310aae8b0547d`
- versión observada: `11.43.0`
- fecha de corte: `2026-09-25`

No se realizan reestructuraciones masivas sobre el repositorio fuente.

## Objetivos de arquitectura

- Monolito modular por dominios.
- TypeScript estricto.
- UI → Application → Domain/Service → Repository → Supabase/API.
- Sin acceso a datos operativos desde componentes de UI.
- Sin secretos o credenciales privilegiadas en navegador, Git o artefactos.
- Migraciones Supabase versionadas.
- CI bloqueante para calidad, seguridad, arquitectura y pruebas.
- Diseño responsive, accesible y observable.
- Archivos pequeños y responsabilidades explícitas.

## Desarrollo

```bash
npm ci
npm run dev
```

Validación completa:

```bash
npm run validate
```

## Despliegue

- **GitHub Pages:** staging estático de la reconstrucción; no usa datos productivos.
- **Vercel:** destino posterior para la aplicación completa cuando los controles P0 estén validados.
- **Supabase:** no se aplican cambios productivos desde este repositorio sin migración revisada, prueba y ventana coordinada.

Consulta `docs/` para arquitectura, seguridad, matrices de auditoría y runbooks.

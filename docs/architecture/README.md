# Arquitectura objetivo

## Estilo

**Monolito modular**. No se crean microservicios mientras un límite de dominio no los justifique operacionalmente.

```text
src/app
  ↓
modules/<dominio>/ui + application
  ↓
ports / contracts de application
  ↑
src/composition
  ↓
src/infrastructure
  ↓
Supabase / APIs externas
  ↓
PostgreSQL / Edge Functions
```

La UI no llama RPC, tablas ni SDK de Supabase directamente. Los módulos de negocio tampoco conocen implementaciones de infraestructura.

## Direction of dependencies

Las reglas comprobadas por `scripts/check-architecture.mjs` son:

- `src/app` no importa `src/infrastructure`.
- `src/modules` no importa Supabase, `src/infrastructure` ni `src/composition`.
- `src/infrastructure` no importa `src/app` ni `src/composition`.
- `src/composition` puede conocer Application e Infrastructure para realizar únicamente el wiring, pero no puede depender de la UI.
- Las capacidades de autorización se consumen desde Application; la UI no decide acceso por nombres de rol.

## Composition root

`src/composition/browser-application.ts` es el punto de composición del runtime de navegador. Allí se conectan:

- `AuthService` ↔ `SupabaseAuthGateway` + `SupabaseSessionRepository`;
- `OrdersService` ↔ `SupabaseOrdersRepository`;
- `createSupabaseBrowserClient` como adaptador de transporte.

El composition root devuelve contratos/servicios que `src/app` puede consumir sin conocer Supabase. Si el runtime no tiene configuración pública de staging, devuelve `null` y la UI queda explícitamente no operativa.

## Dominios previstos

`orders`, `customers`, `credit`, `finance`, `purchasing`, `receiving`, `inventory`, `picking`, `cutting`, `billing`, `logistics`, `workforce`, `approvals`, `reports`, `audit`, `users`, `roles`, `notifications`, `assistant` y `settings`.

Se crean únicamente cuando comienza su migración; no se generan carpetas vacías por apariencia.

## Reglas de tamaño

- Objetivo habitual TS/TSX: 50–250 líneas.
- > 300: revisión de responsabilidad.
- > 500: justificación explícita.
- > 800: CI bloquea salvo archivo generado y excluido conscientemente.
- Funciones >100 líneas: CI bloquea.
- Complejidad ciclomática >20: CI bloquea.

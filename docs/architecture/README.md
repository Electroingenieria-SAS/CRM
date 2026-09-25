# Arquitectura objetivo

## Estilo

**Monolito modular**. No se crean microservicios mientras un límite de dominio no los justifique operacionalmente.

```text
src/app
  ↓
modules/<dominio>/ui
  ↓
modules/<dominio>/application
  ↓
modules/<dominio>/domain
  ↓
modules/<dominio>/infrastructure | shared ports
  ↓
infrastructure/supabase | APIs
  ↓
PostgreSQL / Edge Functions
```

La UI no debe llamar RPC o tablas directamente. Las integraciones externas entran por adaptadores explícitos.

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

## Composition root

`src/app` compone rutas y layouts. La lógica de negocio vive en módulos; infraestructura común vive en `src/infrastructure`; errores, tiempo y primitivas compartidas en `src/shared`.

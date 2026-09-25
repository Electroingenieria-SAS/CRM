# Mapa de dependencias — baseline fuente

## Composición actual

```text
index.html
  ↓
assets/js/app-entry.js
  ├─ cross-cutting runtime modules
  └─ assets/js/main.js
       ├─ router/state/layout/ui
       ├─ módulos de negocio
       └─ services/api.js
            ↓
         Supabase RPC erp_x_*
            ↓
         PostgreSQL
```

`assets/js/services/api.js` referencia directamente 119 nombres RPC `erp_x_*` en el corte auditado. El backend productivo contiene 170 RPC con ese prefijo, por lo que no toda función existente forma parte del contrato del navegador actual.

## Dependencias externas relevantes

- Supabase Auth/PostgREST/Edge Functions.
- Google Apps Script / Drive para soportes documentales.
- GitHub Actions para validación y Pages.
- Vercel para el despliegue histórico/objetivo posterior.

## Regla para el CRM nuevo

Cada dominio tendrá repository/adapter propio. Ningún componente UI importará Supabase. Las dependencias entre dominios se harán por contratos de application/domain, no importando infraestructura interna del vecino.

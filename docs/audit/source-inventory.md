# Inventario técnico del CRM fuente

Corte: 2026-09-25 · commit `4bdceeaa54847581f83e9425aa0310aae8b0547d`.

## Stack observado

- SPA JavaScript ES Modules.
- Supabase Auth/PostgreSQL/RPC/Edge Functions.
- PWA con manifest y service worker.
- GitHub Actions + GitHub Pages.
- Vercel configurado.
- Google Apps Script/Drive como integración documental.

## Volumen

- 357 archivos y 26 directorios en el árbol auditado.
- 135 archivos JS/TS/MJS aproximados.
- 14 hojas CSS.
- 132 archivos SQL.
- 79 entradas bajo `supabase/`.
- 4 Edge Functions productivas observadas.
- 170 RPC públicas `erp_x_*` en la base; 119 son referenciadas por el servicio API del navegador.

## Áreas funcionales

Ventas/pedidos, clientes, crédito, cartera, caja, compras, recepción, inventario, alistamiento, corte, facturación, despacho/entrega, workforce, aprobaciones/excepciones, VSM, reportes, importaciones/histórico, auditoría, administración, PACO e inteligencia de fletes.

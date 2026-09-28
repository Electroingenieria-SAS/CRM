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

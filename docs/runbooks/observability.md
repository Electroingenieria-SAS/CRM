# Runbook — Observabilidad

## Fuentes

- `observability_events`: warnings/errores de cliente sanitizados y rate-limited.
- `audit_events`: acciones críticas de negocio y administración; no usar como log de ruido.
- `erp_x_release_health()`: resumen de errores 24 h, operaciones lentas registradas, importaciones y Orders→Workforce.
- logs de Vercel/Supabase: errores de runtime e integraciones.
- GitHub Actions: calidad y release gates.

## Privacidad

Nunca registrar contraseñas, JWT, tokens, service_role, correos, teléfonos ni direcciones. El backend vuelve a filtrar metadata aunque el cliente ya la haya sanitizado.

## Métricas útiles

- errores y warnings 24 h;
- duración >= 2 s cuando se instrumente una operación;
- importaciones FAILED/APPLYING;
- outbox pendiente/fallida/processing stale;
- fallos de Edge Functions/integraciones desde logs.

No generar métricas de alta cardinalidad con PII ni instrumentar cada click.

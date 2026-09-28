# Freight Intelligence

## Arquitectura

App/UI → Application → Ports → Composition → Infrastructure → RPC SECURITY INVOKER → RLS/PostgreSQL.

## Datos

- freight_carriers: transportadoras estables por organización.
- freight_destinations: catálogo geográfico normalizado.
- freight_historical_aggregates: 749 despachos reales conservados como 166 agregados sin PII.
- freight_observations: costos reales nuevos.
- freight_predictions: estimaciones versionadas.
- freight_prediction_outcomes: error entre estimación y costo final.

Predicción y costo real son entidades distintas.

## Variables auditadas

El histórico legado conserva ciudad, departamento, transportadora, costo, peso agregado, fecha/período, tránsito y origen Tuluá. Para aprendizaje nuevo también se admiten peso, bultos, volumen, servicio, valor declarado y pedido. Las variables opcionales solo refinan el resultado cuando existe evidencia pareada suficiente.

## Fallback

1. CITY
2. DEPARTMENT
3. NATIONAL
4. INSUFFICIENT solo si no existe soporte compatible.

No se mezclan precios de NATIONAL_DISPATCH con LOCAL_DISPATCH.

## Seguridad

- Aislamiento por organization_id.
- Catálogo geográfico global sin PII.
- Histórico y observaciones con RLS.
- RBAC mediante el módulo freight.
- Ventas puede leer/predecir; auditoría solo leer.
- Costos reales requieren update/admin.
- RPC públicas SECURITY INVOKER.
- Producción no se usa como sandbox.

## Integraciones

Orders consume FreightQuotePort y no conoce SQL ni tablas. Logistics podrá registrar costo final mediante recordActual y enlazarlo a la predicción para calcular error.

## Excepciones de tamaño justificadas

Las migraciones del engine/API quedan por debajo del límite bloqueante de 800 líneas, pero superan 500 porque encapsulan contratos SQL atómicos del mismo caso de uso y dividirlas más introduciría dependencias de orden artificiales. El seed histórico supera 500 líneas únicamente porque contiene 166 agregados sanitizados verificables; es dato versionado, no lógica monolítica.

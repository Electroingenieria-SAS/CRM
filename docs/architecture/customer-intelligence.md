# Customer Intelligence

## Capas

src/app/customers/intelligence  
→ modules/customers/ui  
→ modules/customers/application  
→ modules/customers/domain + ports  
→ src/composition  
→ src/infrastructure/customers  
→ public RPC SECURITY INVOKER  
→ erp_supply / erp_private

La UI no calcula Pareto, score ni segmento.

## Flujo de datos

1. Orders asigna customer_id mediante una identidad estable.
2. Billing/Facturación registra facturas en el ledger erp_supply.invoices.
3. Triggers de Orders/Invoices marcan Customer Intelligence como dirty.
4. Un recalculado autorizado toma lock solo de la organización.
5. Calcula agregados, percentiles, score, ranking y Pareto en una operación por lote.
6. Guarda snapshot actual.
7. Solo guarda histórico cuando cambia el segmento.
8. Lecturas posteriores usan snapshots; no recalculan durante render.

## Contrato con Orders

public.erp_x_customer_priority_signal(document) retorna únicamente segmento, prioridad derivada, score, ranking cuando existe, soporte, provisional y versión.

| Segmento | Prioridad futura de pedido |
| --- | --- |
| BASIC | LOW |
| NORMAL | MEDIUM |
| PREMIUM | HIGH |
| URGENT | URGENT |

No existe selector manual como fuente de verdad.

## Seguridad

Las RPC públicas usan SECURITY INVOKER.

La excepción SECURITY DEFINER del cálculo es erp_private.recalculate_customer_intelligence(): es interna, no está en el esquema expuesto, valida perfil + customer_intelligence.admin, tiene search_path fijo y usa un lock por organización.

RLS protege clientes, facturas, snapshots, histórico y estado por organization_id.

## Rendimiento

- No hay consulta N+1.
- Ranking/Pareto salen por RPC de lote.
- UI consume snapshots paginados.
- Pareto visual limita el contrato a 500 puntos.
- Cambios operativos solo marcan estado sucio.
- Un fingerprint del dataset evita recalculados duplicados.

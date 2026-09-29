# Contrato Orders / Workforce · v1.0.0

## Propiedad de los dominios

Orders conserva workflow, tareas y estados del pedido. Workforce conserva actividad, jornada, ocupación, evidencia y calendario.

El bridge guarda únicamente referencias: `order_id`, `order_task_id`, perfiles, step, catálogo y metadatos mínimos.

## Eventos

- `OrderTaskClaimed`
- `OrderTaskAssigned`
- `OrderTaskStarted`
- `OrderBlocked`
- `OrderTaskResumed`
- `OrderTaskCompleted`
- `OrderCancelled`
- `ReconcileOrderTask`

## Mappings

| Orders step | Workforce catalog |
| --- | --- |
| ALISTAMIENTO | LOG_SUPPORT_PICKING |
| CORTE | LOG_SUPPORT_CUTTING |
| LOCAL_DISPATCH | LOG_LOADING |
| NATIONAL_DISPATCH | LOG_LOADING |
| CLIENT_POINT | LOG_LOADING |
| CLIENT_PICKUP | LOG_LOADING |

No existe mapping de PRODUCCION porque el workflow fuente auditado no contiene ese paso separado.

## Persistencia

`erp_supply.order_workforce_outbox` contiene una fila durable por evento. Sus estados son `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED` y `SKIPPED`.

Restricciones principales:

- `UNIQUE (organization_id, dedupe_key)`;
- `order_event_id` único cuando existe;
- FKs a order, task, actor, responsable y vendedor;
- RLS por organización/capacidad.

## RPC de bridge

| RPC | Propósito |
| --- | --- |
| `erp_x_order_workforce_pending` | lectura acotada de eventos procesables |
| `erp_x_order_workforce_claim_outbox` | claim atómico de consumidor |
| `erp_x_order_workforce_mark_processed` | ACK con activity_id |
| `erp_x_order_workforce_mark_failed` | fallo + backoff |
| `erp_x_order_workforce_reconcile` | detectar/reparar integración faltante |
| `erp_x_order_workforce_binding` | resolver activity_id de una order_task |
| `erp_x_order_workforce_health` | backlog/fallos/locks agregados |
| `erp_x_workforce_create_from_order_event` | crear actividad ORDER_EVENT en ventana laboral |
| `erp_x_workforce_reassign_from_order_event` | reasignar PLANNED o segmentar actividad activa |
| `erp_x_order_workforce_completion_readiness` | impedir COMPLETE inconsistente |
| `erp_x_order_workforce_indicators` | ocupación y tiempos agregados |

Las RPC públicas son `SECURITY INVOKER`. Los helpers privados que necesitan atravesar RLS usan `SECURITY DEFINER` con `search_path` explícito y grants mínimos.

## Idempotencia

La identidad de actividad y la identidad de mutación son distintas:

```text
activityKey = orders-workforce:<order_task_id>:activity
eventKey    = orders-workforce:event:<order_event_id>
```

Esto permite que CLAIM/START/BLOCK/RESUME/COMPLETE afecten la misma actividad sin que una mutación sea confundida con otra.

## Evidencia y COMPLETE

Antes de completar una etapa mapeada, Orders consulta readiness.

- actividad inexistente → bloquea;
- actividad no iniciada/bloqueada → bloquea;
- evidencia obligatoria ausente → bloquea;
- IN_PROGRESS + evidencia válida → Orders puede completar;
- después del commit, `OrderTaskCompleted` cierra Workforce.

Las fotografías no se duplican en Orders.

## Reasignación

Una actividad activa no cambia simplemente `assignee_profile_id`. El segmento anterior queda cerrado y una continuación toma el nuevo responsable. Así los indicadores no trasladan tiempo histórico de A a B.

## Ocupación y tiempos

Se reutilizan `workforce_is_working_instant`, `workforce_business_seconds`, schedule segments, holidays y profile policies.

Los indicadores distinguen tiempo productivo, tiempo bloqueado y estado de ocupación. La regla especial de una persona se configura mediante `workforce_profile_policies`; no hay nombres hardcodeados.

## Seguridad

- `anon` no puede ejecutar RPC operativas.
- `authenticated` sigue sujeto a RLS/RBAC.
- organización A no ve ni altera integración B.
- el responsable solo opera perfiles autorizados por Workforce.
- reconciliación con reparación requiere capacidad de Orders update o Workforce admin.

## Recuperación

No se usa polling. Un evento fallido permanece visible, aplica backoff y puede ser reclamado posteriormente. La reconciliación es explícita y auditable.

# Pedidos · workflow operativo

Fecha de corte: 2026-09-28.

## Objetivo

El dominio de Pedidos controla la vida operativa posterior a la creación. React no decide transiciones, permisos ni rutas: consume el contrato publicado por PostgreSQL.

## Modelo

```text
orders
  │
  ├─ order_tasks ─ task_sessions
  │       │
  │       └─ order_blocks
  │
  ├─ order_issues
  ├─ order_evidence
  └─ order_events  (append-only)

workflow_steps
workflow_transitions
step_roles
workflow_step_requirements
order_action_authorities
```

## Acciones de tarea

| Acción | Precondición principal | Resultado |
| --- | --- | --- |
| CLAIM | tarea QUEUED, rol con `can_claim` | ASSIGNED + responsable |
| ASSIGN | tarea QUEUED/ASSIGNED, rol con `can_assign` | ASSIGNED al perfil elegible |
| START | ASSIGNED y actor responsable/override | IN_PROGRESS + sesión |
| BLOCK | IN_PROGRESS y actor responsable/override | BLOCKED + registro de bloqueo |
| RESUME | BLOCKED + bloqueo abierto + resolución | IN_PROGRESS + nueva sesión |
| COMPLETE | IN_PROGRESS + owner + requisitos + sin bloqueos/incidencias bloqueantes | COMPLETED + siguiente tarea/cierre |

Las transiciones de etapa se resuelven en `workflow_transitions`. No existe un switch de workflow en React.

## Concurrencia P0

Las mutaciones críticas:

1. bloquean la fila de `orders` mediante `FOR UPDATE`;
2. bloquean la tarea activa cuando corresponde;
3. comparan `orders.version` para optimistic concurrency;
4. usan actualización condicional para CLAIM;
5. escriben evento con `idempotency_key` único.

En una carrera de dos CLAIM sobre la misma tarea solo uno puede actualizar `QUEUED + assigned_profile_id IS NULL`. El segundo recibe:

> Esta tarea ya fue tomada por otro usuario.

CI ejecuta dos sesiones Auth reales en paralelo y exige exactamente un ganador, un evento CLAIM y un responsable.

## Idempotencia

Las operaciones mutantes reciben `idempotency_key`.

Antes de repetir una mutación se consulta `order_events`. Reintentar COMPLETE con la misma clave retorna `idempotent=true` y no crea una segunda tarea ni un segundo evento.

## Transiciones base certificadas

El catálogo actual reconstruye la semántica más reciente verificada del CRM fuente:

- CARTERA → RECEPCION_PEDIDO;
- CAJA → RECEPCION_PEDIDO;
- COMPRAS → RECEPCION_MERCANCIA;
- RECEPCION_MERCANCIA → RECEPCION_PEDIDO;
- RECEPCION_PEDIDO → ALISTAMIENTO;
- ALISTAMIENTO → CAJA_FACTURACION para PVN;
- ALISTAMIENTO → FACTURACION para los demás tipos;
- CAJA_FACTURACION / FACTURACION → modalidad de entrega;
- modalidad de entrega → CLOSURE;
- CLOSURE → CLOSED.

CORTE se conserva como etapa/catalogación operativa e integración futura, pero el legado más reciente convirtió el corte de materiales en un subflujo paralelo al pedido principal. Este hilo no reconstruye el microproceso de Corte; corresponde a su dominio especializado.

## Bloqueos e incidencias

Un bloqueo modifica la tarea operativa y exige una resolución explícita antes de reanudar.

Una incidencia es un hecho operativo separado. Puede ser informativa o bloqueante. Una incidencia bloqueante abierta impide COMPLETE, pero no se confunde con `order_blocks`.

## Evidencias

PostgreSQL guarda únicamente referencia, tipo, proveedor y metadatos mínimos. Los binarios permanecen en el proveedor de almacenamiento autorizado. El límite lógico de referencia es 15 MB para metadatos de archivo.

Los requisitos por etapa se modelan en `workflow_step_requirements`. CLOSURE exige `CLOSURE_PROOF` en el baseline actual.

## Cancelación y reapertura

No existe edición silenciosa de `status`.

- CANCEL requiere autoridad explícita, razón, versión e idempotencia.
- REOPEN requiere autoridad explícita, razón y una etapa no terminal del catálogo.
- ambas operaciones agregan un evento histórico.

Las autoridades iniciales de cancelación/reapertura son Jefatura logística, Gerencia y Superadmin. Aprobaciones avanzadas permanecen fuera de este hilo.

## Eventos de integración

`order_events.payload.integrationEvent` expone contratos consumibles sin acoplar módulos:

- `OrderTaskClaimed`
- `OrderTaskAssigned`
- `OrderTaskStarted`
- `OrderBlocked`
- `OrderTaskResumed`
- `OrderTaskCompleted`
- `OrderClosed`
- `OrderCancelled`
- `OrderReopened`
- `OrderIssueCreated`
- `OrderIssueResolved`

Workforce puede consumir estos eventos posteriormente para crear/actualizar actividades. Pedidos no importa Workforce ni escribe en sus tablas.

## Límites de dominio

Este bloque no implementa:

- segmentación/score de Customer Intelligence;
- cálculo predictivo de Freight Intelligence;
- cronograma Workforce;
- motor completo de Aprobaciones;
- microprocesos de Corte, Facturación, Compras o Despacho.

Pedidos solo publica contratos y eventos para esos dominios.

## Seguridad

- RPC públicas operativas: SECURITY INVOKER.
- Helpers privilegiados: `erp_private`, SECURITY DEFINER con `search_path` explícito y grants mínimos.
- RLS en pedidos, tareas, bloqueos, incidencias, evidencias y sesiones.
- FKs compuestas garantizan coherencia organización/pedido y tarea/pedido.
- `order_events` no concede UPDATE ni DELETE a `authenticated`.

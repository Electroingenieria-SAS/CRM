# ADR-0003 · Máquina de estados de Pedidos persistida

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto

El CRM legado evolucionó su enrutamiento en múltiples migraciones. Un workflow codificado como condicionales en componentes React volvería a dispersar reglas y haría difícil certificar concurrencia, permisos y paridad.

## Decisión

La fuente de verdad del workflow es PostgreSQL:

- `workflow_steps`: etapas;
- `workflow_transitions`: rutas condicionadas;
- `step_roles`: capacidades operativas;
- `workflow_step_requirements`: precondiciones;
- `order_action_authorities`: acciones excepcionales.

Las RPC públicas usan SECURITY INVOKER. Los helpers que necesitan resolver contexto atravesando RLS viven exclusivamente en `erp_private`.

La UI solicita el detalle del pedido y recibe `workflow.actions` ya autorizadas. React no calcula la siguiente etapa.

## Concurrencia

Se combina bloqueo pesimista de la fila, versión optimista e idempotencia. Esta combinación resuelve tanto carreras simultáneas como retries de red.

## Consecuencias

- cambiar una ruta no exige reescribir componentes;
- las reglas pueden probarse con pgTAP;
- Workforce/Aprobaciones pueden consumir contratos/eventos sin dependencia circular;
- una transición inexistente falla cerrada, en lugar de enviar el pedido arbitrariamente a CLOSED.

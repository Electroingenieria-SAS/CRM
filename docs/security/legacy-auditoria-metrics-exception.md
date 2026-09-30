# Excepción temporal legacy — erp-auditoria-metrics

## Alcance

Esta excepción aplica únicamente al **CRM legado** durante la coexistencia/cutover. El CRM reconstruido no debe depender de esta Edge Function.

## Evidencia observada — 2026-09-30

- El deployment productivo legacy continúa aceptando tráfico sin `Authorization`.
- En la ventana observada hubo **18 GET exitosos** sin `Authorization`, `Origin`, `Referer` ni `User-Agent`.
- El repositorio `CRM-SUMINISTROS/main` ya contiene una implementación endurecida que exige JWT, CORS allowlist y RPC org-scoped.
- Por lo anterior existe **drift de deployment** y no es seguro reemplazar la función productiva abruptamente sin identificar/adaptar el consumidor.

## Decisión de release

- **No migrar** esta función al CRM nuevo.
- **No desplegar** el hardening sobre el legado durante el cutover.
- Mantener el legado en read-only durante coexistencia.
- Monitorizar volumen/errores del endpoint en Hilo 16.
- Identificar el consumidor antes de aplicar JWT obligatorio.
- Una vez identificado/adaptado, desplegar la versión endurecida existente y ejecutar smoke positivo/negativo.

## Criterio de cierre definitivo

1. consumidor identificado;
2. consumidor autenticado con JWT válido;
3. origins necesarios incluidos explícitamente;
4. versión endurecida desplegada;
5. requests anónimos reciben 401/403;
6. smoke funcional de Auditoría verde.

Esta excepción no autoriza nuevas dependencias sobre el endpoint ni su uso por el CRM nuevo.

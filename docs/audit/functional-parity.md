# Matriz de paridad funcional

`✓` significa validado con evidencia; `—` aún no migrado.

| Funcionalidad                      |   CRM fuente   |    CRM nuevo    |        Tests        | Mobile | Seguridad | Estado                            |
| ---------------------------------- | :------------: | :-------------: | :-----------------: | :----: | :-------: | --------------------------------- |
| Shell/base técnica                 |       ✓        |        ✓        |          ✓          |   ✓    |     ✓     | Validado en staging               |
| Login / sesión                     |       ✓        |        ✓        |     Unit + E2E      |   ✓    |     ✓     | Validado en staging               |
| Recuperación de contraseña         | Fuente parcial |        ✓        |     Unit + E2E      |   ✓    |     ✓     | Validado en staging               |
| Dashboard / centro de operaciones  |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado · evidencia CI en PR |
| Pedidos / ventas                   |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado integralmente            |
| Segmentación de clientes           |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #7                    |
| Inteligencia/predicción de fletes  |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado                          |
| Crédito                            |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado                          |
| Cartera                            |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado                          |
| Caja                               |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado                          |
| Compras                            |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #23                   |
| Recepción                          |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #23                   |
| Alistamiento                       |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #23                   |
| Corte                              |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #23                   |
| Facturación                        |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado; gate final PR #17   |
| Despachos / entrega / satisfacción |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado; gate final PR #17   |
| Inventario                         |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado · evidencia CI en PR |
| Workforce / jornada / cronograma   |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado PR #11                   |
| Orders ↔ Workforce automation      |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #12                   |
| Excepciones / aprobaciones         |       ✓        | Finance parcial | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado financiero               |
| VSM / tiempos                      |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado · evidencia CI en PR |
| Reportes / analítica               |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado · evidencia CI en PR |
| Histórico/importaciones            |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Implementado · evidencia CI en PR |
| Auditoría                          |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #19                   |
| Administración / roles             |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #19                   |
| PACO asistente                     |       ✓        |        ✓        | Unit + pgTAP + E2E  |   ✓    |     ✓     | Validado PR #19                   |

Ninguna fila pasa a “Validado” solo por existir código: requiere pruebas, seguridad, responsive y evidencia.

> “Base técnica” no equivale a paridad. Auth/sesión/recuperación ya están validados en staging; Hilo 12 añade MFA TOTP administrativo con enforcement AAL2, Administración modular, Auditoría append-only y PACO operacional. Su estado final depende del CI del PR de cierre.

> Pedidos ya incorpora workflow operativo de claim, asignación, inicio, bloqueo, reanudación, finalización y trazabilidad. Hilo 6 conecta las etapas operativas mapeadas con Workforce mediante outbox, lifecycle real, evidencia y ocupación; aprobaciones y otros dominios mantienen sus propios bloques.

> Evidencia: PR #6, commit `e1c4b9ca092d15f904379dc26be7851c00abf90c`, pipeline #105 (`36453408365`) completamente verde, incluido `e2e-authenticated`.

| Customer Intelligence / Pareto | CRM viejo V11.39.x | CRM nuevo 1.0.0 | Unit + pgTAP + E2E | Responsive | RLS/RBAC | Validado final del PR |

> Finanzas reconstruye Crédito, Cartera y Caja con fuente monetaria basada en facturas registradas netas de reversos. No se inventa cupo reutilizable ni días de mora sin fuente auditable. Orders consume únicamente un gate financiero mínimo y Customer Intelligence una proyección `totalPaid`.

> Hilo 10 conserva Finance como fuente de facturas/pagos, separa costo estimado de costo real,
> usa evidencia privada referenciada y controla estados logísticos. Inventory ya está en `main`; su
> contrato actual termina en Receiving/Picking/Cutting y no expone una mutación de despacho por
> `orderId`, por lo que Logistics no escribe sus tablas ni inventa una adaptación incompatible.

## Certificación transversal — Hilo 13

La integración global se certifica sobre `main` mediante un único entorno Supabase local y fixtures sintéticos compartidos. El gate autenticado ejecuta en conjunto Orders, Customer Intelligence, Freight, Finance, Workforce, Orders↔Workforce, Inventory, Supply, Billing/Logistics, Analytics, Admin/Audit/PACO y accesibilidad.

Además, la creación de pedidos consume en backend la señal `erp_x_customer_priority_signal`; la prioridad manual continúa fuera del formulario y la integración queda cubierta por pgTAP y E2E.

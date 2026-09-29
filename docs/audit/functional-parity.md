# Matriz de paridad funcional

`✓` significa validado con evidencia; `—` aún no migrado.

| Funcionalidad                      |   CRM fuente   |    CRM nuevo    |        Tests        | Mobile | Seguridad | Estado                 |
| ---------------------------------- | :------------: | :-------------: | :-----------------: | :----: | :-------: | ---------------------- |
| Shell/base técnica                 |       ✓        |        ✓        |          ✓          |   ✓    |     ✓     | Validado en staging    |
| Login / sesión                     |       ✓        |        ✓        |     Unit + E2E      |   ✓    |     ✓     | Validado en staging    |
| Recuperación de contraseña         | Fuente parcial |        ✓        |     Unit + E2E      |   ✓    |     ✓     | Validado en staging    |
| Dashboard / centro de operaciones  |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Pedidos / ventas                   |       ✓        | UI + núcleo/API | Unit + DB/RLS + E2E |   ✓    |     ✓     | Slice inicial validado |
| Segmentación de clientes           |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Inteligencia/predicción de fletes  |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado               |
| Crédito                            |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado               |
| Cartera                            |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado               |
| Caja                               |       ✓        |        ✓        | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado               |
| Compras                            |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Recepción                          |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Alistamiento                       |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Corte                              |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Facturación                        |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Despachos / entrega / satisfacción |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Inventario                         |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Workforce / jornada / cronograma   |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Excepciones / aprobaciones         |       ✓        | Finance parcial | Unit + DB/RLS + E2E |   ✓    |     ✓     | Validado financiero    |
| VSM / tiempos                      |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Reportes / analítica               |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Histórico/importaciones            |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Auditoría                          |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| Administración / roles             |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |
| PACO asistente                     |       ✓        |        —        |          —          |   —    |     —     | Pendiente              |

Ninguna fila pasa a “Validado” solo por existir código: requiere pruebas, seguridad, responsive y evidencia.

> “Base técnica” no equivale a paridad. Auth/sesión/recuperación ya están validados en staging; MFA y administración siguen perteneciendo a un bloque posterior de seguridad/administración.

> Pedidos tiene validado el vertical slice inicial: núcleo SQL/API, integridad, idempotencia, Application/Repository, UI, responsive, RBAC/RLS y E2E autenticado. Claim, asignación, inicio, bloqueo, finalización, aprobaciones y demás workflow operativo siguen fuera de este slice.

> Evidencia: PR #6, commit `e1c4b9ca092d15f904379dc26be7851c00abf90c`, pipeline #105 (`36453408365`) completamente verde, incluido `e2e-authenticated`.

| Customer Intelligence / Pareto | CRM viejo V11.39.x | CRM nuevo 1.0.0 | Unit + pgTAP + E2E | Responsive | RLS/RBAC | Implementado; pendiente CI final del PR |

> Finanzas reconstruye Crédito, Cartera y Caja con fuente monetaria basada en facturas registradas netas de reversos. No se inventa cupo reutilizable ni días de mora sin fuente auditable. Orders consume únicamente un gate financiero mínimo y Customer Intelligence una proyección `totalPaid`.

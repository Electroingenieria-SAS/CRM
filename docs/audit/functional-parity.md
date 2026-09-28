# Matriz de paridad funcional

`✓` significa validado con evidencia; `—` aún no migrado.

| Funcionalidad                      |   CRM fuente   |    CRM nuevo    |             Tests             | Mobile | Seguridad | Estado                    |
| ---------------------------------- | :------------: | :-------------: | :---------------------------: | :----: | :-------: | ------------------------- |
| Shell/base técnica                 |       ✓        |        ✓        |               ✓               |   ✓    |     ✓     | Validado en staging       |
| Login / sesión                     |       ✓        |  UI + gateway   |     Unit + E2E pendiente      |   ✓    | En curso  | Implementado, no validado |
| Recuperación de contraseña         | Fuente parcial |  UI + gateway   |             Unit              |   ✓    | En curso  | Implementado, no validado |
| Dashboard / centro de operaciones  |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Pedidos / ventas                   |       ✓        | UI + núcleo/API | Unit + DB/RLS + E2E pendiente |   ✓    | En curso  | Implementado, no validado |
| Segmentación de clientes           |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Inteligencia/predicción de fletes  |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Crédito                            |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Cartera                            |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Caja                               |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Compras                            |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Recepción                          |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Alistamiento                       |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Corte                              |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Facturación                        |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Despachos / entrega / satisfacción |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Inventario                         |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Workforce / jornada / cronograma   |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Excepciones / aprobaciones         |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| VSM / tiempos                      |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Reportes / analítica               |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Histórico/importaciones            |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Auditoría                          |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| Administración / roles             |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |
| PACO asistente                     |       ✓        |        —        |               —               |   —    |     —     | Pendiente                 |

Ninguna fila pasa a “Validado” solo por existir código: requiere pruebas, seguridad, responsive y evidencia.

> “Base técnica” no equivale a paridad: faltan pantallas, integración con entorno no productivo, E2E autenticado, MFA/administración y pruebas de autorización antes de validar estas filas.

> Pedidos tiene ya núcleo SQL/API, integridad, idempotencia y capa Application/Repository. Sigue sin marcarse `Validado` hasta completar UI, recorrido autenticado, responsive del módulo y paridad de acciones operativas.

> Este tranche añade login real, shell privado, lista/filtros, creación idempotente y detalle de pedido. El estado seguirá sin ser `Validado` hasta que el job `e2e-authenticated` termine verde en todos los proyectos de Playwright configurados.

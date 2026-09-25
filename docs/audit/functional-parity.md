# Matriz de paridad funcional

`✓` significa validado con evidencia; `—` aún no migrado.

| Funcionalidad                      |   CRM fuente   | CRM nuevo | Tests | Mobile | Seguridad | Estado              |
| ---------------------------------- | :------------: | :-------: | :---: | :----: | :-------: | ------------------- |
| Shell/base técnica                 |       ✓        |     ✓     |   ✓   |   ✓    |     ✓     | Validado en staging |
| Login / sesión                     |       ✓        | Base técnica | Unit |   —    | En curso  | Implementación parcial |
| Recuperación de contraseña         | Fuente parcial | Base técnica | Unit |   —    | En curso  | Implementación parcial |
| Dashboard / centro de operaciones  |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Pedidos / ventas                   |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Segmentación de clientes           |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Inteligencia/predicción de fletes  |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Crédito                            |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Cartera                            |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Caja                               |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Compras                            |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Recepción                          |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Alistamiento                       |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Corte                              |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Facturación                        |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Despachos / entrega / satisfacción |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Inventario                         |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Workforce / jornada / cronograma   |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Excepciones / aprobaciones         |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| VSM / tiempos                      |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Reportes / analítica               |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Histórico/importaciones            |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Auditoría                          |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| Administración / roles             |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |
| PACO asistente                     |       ✓        |     —     |   —   |   —    |     —     | Pendiente           |

Ninguna fila pasa a “Validado” solo por existir código: requiere pruebas, seguridad, responsive y evidencia.

> “Base técnica” no equivale a paridad: faltan pantallas, integración con entorno no productivo, E2E autenticado, MFA/administración y pruebas de autorización antes de validar estas filas.

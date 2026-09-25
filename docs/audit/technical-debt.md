# Matriz de deuda técnica inicial

| Archivo fuente | Líneas aprox. | Señal | Complejidad/Acoplamiento | Acción en CRM nuevo |
|---|---:|---|---|---|
| `assets/js/modules/orders.js` | 994 | ~111 funciones | Alta | Separar UI, casos de uso, repository, mapper y validación por pedidos. |
| `assets/js/modules/workforce.js` | 1.113 | ~128 funciones | Alta | Dividir planner, jornada, ejecución, evidencias, revisión y analítica. |
| `assets/js/modules/paco-operational-v11370.js` | 1.229 | ~154 funciones | Alta | Separar intents, eventos, notificaciones, speech y adaptadores CRM. |
| `assets/js/modules/operational-v112.js` | 427 | múltiples responsabilidades | Media/Alta | Reubicar por dominio; evitar un “operational” transversal. |
| `assets/css/operations.css` | 6.156 | God stylesheet | Alta | Design tokens + CSS modules/estilos por dominio. |
| `assets/css/core-shell.css` | 1.181 | shell y overrides acumulados | Alta | Shell pequeño + componentes compartidos. |
| `assets/css/analytics.css` | 1.992 | analítica/admin mezclados | Alta | Estilos colocados junto a cada módulo. |

Los límites de líneas son alarmas, no objetivos artificiales de fragmentación.

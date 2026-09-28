# Pedidos — UI del primer vertical slice

Corte: 2026-09-28.

## Alcance

Este slice cubre únicamente el alta y consulta inicial del pedido:

- listado;
- búsqueda;
- filtros;
- creación;
- múltiples materiales;
- cantidad;
- corte opcional y longitud;
- detalle posterior;
- estados loading/error/empty;
- cierre de sesión desde shell privado.

No incluye todavía claim, asignación, inicio, bloqueo, finalización, aprobaciones ni etapas posteriores del workflow.

## Catálogos

La creación y los filtros de tipo/ruta consumen catálogos del contexto de sesión. Los códigos de dominio no se traducen en reglas hardcodeadas dentro de componentes.

La prioridad **no se solicita al usuario**. El backend conserva temporalmente el valor trazable definido por el baseline hasta que Customer Intelligence asuma esa decisión en otro dominio.

## Seguridad

- El botón de creación aparece solo cuando el contexto tiene `orders.create`.
- La ocultación del botón no es el control de seguridad: RPC + RLS/RBAC vuelven a validar la operación.
- Un usuario `auditoria` puede leer lo permitido pero no crear.
- El aislamiento entre organizaciones permanece cubierto por pgTAP.

## E2E autenticado

Playwright usa Auth real contra Supabase local:

1. reconstruye la base;
2. crea usuarios sintéticos;
3. inicia sesión;
4. restaura sesión después de reload;
5. abre Pedidos;
6. crea un pedido;
7. lo busca;
8. abre su detalle;
9. verifica prioridad automática;
10. verifica logout y bloqueo de ruta anónima.

Los proyectos Playwright configurados cubren Chromium, Firefox, WebKit, Pixel 7, iPhone 13 e iPad. Los smokes responsive adicionales mantienen 320, 375, 390, 430, 768, 1024, 1366 y 1920 px.

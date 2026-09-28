# Autenticación y sesión

Corte: 2026-09-28.

## Responsabilidades

`AuthService` es la fachada de Application para autenticación. Coordina el puerto `AuthGateway` y `SessionRepository`; ningún componente React llama Supabase directamente.

El contexto operativo proviene de `erp_x_session` e incluye:

- perfil;
- organización;
- roles;
- módulos y capacidades;
- catálogos operativos;
- versión del contrato.

La UI usa capacidades como `orders.create` derivadas del contexto de módulos. No usa comparaciones dispersas del tipo `role === admin`.

## Flujos cubiertos

### Login

1. La UI valida correo/contraseña.
2. `AuthService.signIn` autentica mediante el gateway.
3. Inmediatamente carga el contexto operativo.
4. Si el contexto falla, la sesión recién abierta se cierra.
5. Solo con sesión + contexto válidos se navega a Pedidos.

### Restauración y expiración

`restoreContext` comprueba la sesión, rechaza una expiración ya alcanzada y carga nuevamente el contexto operativo. El shell escucha eventos de cierre de sesión y vuelve a `/login`.

### Recuperación

La UI siempre muestra un mensaje genérico para la solicitud de recuperación. La ruta `/auth/update-password` valida la sesión de recuperación; en PKCE intercambia el código antes de habilitar el formulario.

Un enlace inválido/expirado produce un mensaje seguro sin SQL, JWT ni detalles internos.

### Cambio de contraseña

La contraseña nueva se valida en el límite de Application y exige al menos 12 caracteres. La confirmación se valida en UI. Tras una actualización satisfactoria se cierra la sesión local y se solicita iniciar sesión con la nueva contraseña.

Las contraseñas nunca se almacenan en el repositorio ni se registran en logs.

## E2E

El job `e2e-authenticated` levanta Supabase local, genera una contraseña aleatoria por ejecución y crea identidades sintéticas.

La recuperación real utiliza Mailpit del stack local para capturar el correo generado por Supabase y seguir el enlace PKCE. El usuario de recuperación es exclusivo de ese escenario para que el cambio de contraseña no afecte a vendedor/auditor.

Producción no participa en estas pruebas.

## Evidencia de validación

Validado en el PR #6 sobre el commit `e1c4b9ca092d15f904379dc26be7851c00abf90c`.

Pipeline #105 (`36453408365`):

- quality: verde;
- database reset + pgTAP/RLS + DB lint: verde;
- CodeQL: verde;
- secret scan: verde;
- supply-chain/npm audit: verde;
- smoke responsive/semántico: verde;
- E2E autenticado real contra Supabase local: verde.

El recorrido autenticado verifica entrada anónima bloqueada, login real, restauración de sesión, contexto operativo, permisos de ventas/auditoría, logout, enlace de recuperación inválido, recuperación real mediante Mailpit, validación de contraseña débil, confirmación incorrecta y acceso con la contraseña nueva.

Producción no fue utilizada ni modificada.

# Seguridad

## Reporte responsable

Este repositorio no publica credenciales, tokens, llaves privadas ni datos productivos. Los incidentes internos deben escalarse por el canal corporativo autorizado; no se deben publicar secretos en Issues, Pull Requests o capturas.

## Reglas no negociables

- `service_role`, secret keys, contraseñas y private keys nunca llegan al navegador ni a Git.
- Solo configuración expresamente pública puede usar prefijo `NEXT_PUBLIC_`.
- Toda autorización se valida server-side/base de datos; ocultar un botón no autoriza una operación.
- Cambios SQL permanentes se versionan en `supabase/migrations/`.
- `SECURITY DEFINER` requiere justificación, autorización interna, `search_path` seguro y grants mínimos.
- No se usan datos personales productivos en pruebas locales.
- Un hallazgo P0 bloquea la promoción a producción.

## Incidente de credenciales

1. Revocar/rotar primero la credencial real.
2. Identificar alcance y uso.
3. Remover el secreto del código.
4. Limpiar historia si corresponde.
5. Ejecutar escaneo completo nuevamente.
6. Documentar el incidente sin reproducir el valor secreto.

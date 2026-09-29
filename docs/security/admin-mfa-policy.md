# Política MFA administrativa

## Alcance

MFA se exige para operaciones administrativas sensibles, no arbitrariamente para todos los usuarios.

La política inicial marca `super_admin` como rol sensible. Otros roles pueden incorporarse mediante `security_role_policies` cuando sus capacidades lo justifiquen.

## Enforcement

La protección real está en PostgreSQL:

1. capacidad `admin.admin`;
2. sesión Auth válida;
3. claim `aal=aal2`.

La UI puede orientar al usuario, pero no sustituye las guardas backend.

## Factor

Se usa TOTP de Supabase Auth. La voz, PACO y otros módulos no pueden elevar AAL ni saltarse este requisito.

## Recuperación

Nunca se muestra contraseña actual ni se crea una contraseña manual desde Admin. Los resets usan el flujo de recuperación de Supabase y dejan evento auditado.

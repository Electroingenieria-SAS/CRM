# ADR-0002 · Staging de base de datos en plan Free

Fecha: 2026-09-28  
Estado: Aceptado

## Contexto

El proyecto Supabase productivo pertenece a la organización `ERP EI`, actualmente en plan Free. La documentación vigente de Supabase reserva Branching persistente/preview para Pro y los branches generan consumo facturable.

La reconstrucción no puede convertir producción en entorno de QA ni generar costos sin aprobación.

## Decisión

Mientras la organización permanezca en Free:

1. Producción se trata como solo referencia y destino final coordinado.
2. El entorno de integración de base de datos se reconstruye en CI usando Supabase local.
3. Cada ejecución parte de cero mediante migraciones versionadas.
4. Los datos de prueba se cargan exclusivamente desde `supabase/seed.sql` y fixtures sintéticos.
5. `supabase test db` ejecuta pgTAP para integridad y RLS.
6. `supabase db lint` bloquea errores de funciones PostgreSQL.
7. Ninguna prueba CI utiliza credenciales ni datos reales de producción.
8. Si en el futuro se habilita Pro, puede añadirse un branch persistente `staging` sin eliminar las pruebas locales.

## Consecuencias

- Se obtiene reproducibilidad sin costo adicional.
- Auth, RLS y SQL pueden certificarse antes de tocar producción.
- Las pruebas de servicios alojados específicos de Supabase Platform deberán completarse en un staging remoto si se habilita posteriormente.
- El deploy a producción permanece bloqueado hasta que el dominio correspondiente tenga migración, pruebas, seguridad y paridad verificadas.

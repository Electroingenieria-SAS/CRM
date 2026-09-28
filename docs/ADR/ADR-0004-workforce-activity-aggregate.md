# ADR-0004 · Workforce como agregado único de actividad

- Estado: Aceptado
- Fecha: 2026-09-28

## Contexto

El CRM fuente separó planificación, miembros y ejecución en varias tablas y luego acumuló capas de compatibilidad. El dominio nuevo necesita planificación, jornada, ocupación, evidencia, concurrencia e historial sin duplicar pedidos.

## Decisión

Una actividad Workforce es el agregado operativo principal. Conserva planificación y ejecución en una sola entidad versionada. Evidencias y eventos son entidades subordinadas.

Las decisiones de seguridad y transición viven en PostgreSQL/Application, no en React.

Las excepciones de métricas se modelan por perfil en `workforce_profile_policies`. No se comparan nombres de personas.

## Consecuencias

- menos joins y menos llamadas para Día/Semana/Mes;
- una actividad manual o ligada a Orders aparece en la misma consulta;
- el creador no controla visibilidad;
- idempotencia y optimistic concurrency se concentran en un único agregado;
- el almacenamiento de archivos queda desacoplado mediante port.

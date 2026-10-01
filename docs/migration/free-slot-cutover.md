# Hilo 15 — Cutover Free-only por rotación de cupo Supabase

## Contexto confirmado

La organización Supabase permanece en plan Free. La documentación oficial vigente indica:

- se permiten dos proyectos Free **activos** por cuota aplicable;
- los proyectos **pausados no cuentan** para esa cuota;
- el límite puede bloquearse por otro miembro Owner/Admin que ya haya consumido su cuota.

El proyecto legacy operativo es `hezjxcxxcjlpmyalftam`.

La inspección de 2026-09-30 confirmó que el proyecto legacy todavía **no contiene el modelo nuevo**:

- `erp_supply.inventory_balances`: ausente;
- `erp_supply.inventory_reservations`: ausente;
- `erp_supply.logistics_shipments`: ausente;
- `erp_supply.workforce_activities`: ausente;
- `erp_supply.customer_intelligence_scores`: ausente.

También se observaron 77 tablas legacy, 142 funciones dentro de `erp_supply` y 168 funciones públicas que referencian explícitamente `erp_supply`.

Por ello, no se considera segura una sustitución in-place del esquema sin un rehearsal específico y completo.

## Revalidación de capacidad 2026-10-01

La API de Supabase reportó costo **USD 0/mes** para crear un proyecto adicional en la organización accesible `ERP EI`. Ese dato confirma costo, **no confirma todavía disponibilidad efectiva de cuota**: la creación no se ejecutó porque Supabase exige seleccionar/autorizar explícitamente la organización antes de crear el proyecto.

Si Supabase acepta la creación del target Free antes del freeze, la estrategia cambia a **target-first**: crear y preparar el target con antelación, ejecutar MIG-002, migración/reconciliación/UAT y reservar la pausa del legacy solo para el freeze final. Esto reduce riesgo y downtime.

Si la creación vuelve a ser rechazada por cuota Free, se mantiene como fallback la rotación de cupo documentada abajo.

## Estrategia preferida

Mientras no exista un target Free creado y validado, la estrategia de fallback para producción es **rotación de cupo durante la ventana de mantenimiento**, no staging persistente:

1. ensayar localmente con copia real;
2. freeze del legacy;
3. backup lógico final + checksum;
4. pausar el proyecto legacy únicamente después de validar el backup;
5. crear el nuevo proyecto Free usando el cupo liberado;
6. desplegar el esquema nuevo limpio mediante migraciones versionadas;
7. migrar Auth según el procedimiento documentado;
8. transformar/importar datos operativos legacy;
9. reconciliar;
10. apuntar un Preview Vercel al nuevo Supabase;
11. ejecutar UAT migrada;
12. decidir GO/ROLLBACK;
13. promover el deployment validado;
14. entregar baseline a Hilo 16.

El proyecto legacy debe permanecer pausado, no eliminado, durante la coexistencia inicial para conservar una vía de rollback. La integración disponible expone operaciones explícitas de pausa y restauración del mismo proyecto; la restauración se usa únicamente si el gate de rollback lo exige.

## Gate previo al freeze

No pausar Supabase ni iniciar el cutover si falta cualquiera de:

- `MIGRATION_SOURCE_DB_URL` almacenado como secreto protegido;
- backup/restore rehearsal real en local;
- transformación real legacy → target local;
- reconciliación agregada;
- reconciliación de pedidos activos;
- validación Auth/perfiles;
- pipeline completo verde;
- deployment Vercel del SHA candidato en estado `READY`;
- owner técnico disponible;
- capacidad administrativa para cambiar variables de entorno Vercel en la ventana.

## Auth

La migración entre proyectos debe seguir `docs/migration/auth-strategy.md`:

- preservar UUID cuando el mecanismo soportado lo permita;
- migrar usuarios/hashes mediante mecanismo soportado;
- no extraer contraseñas en texto plano;
- no reutilizar JWT secret legacy solo para preservar sesiones;
- asumir re-login después del GO;
- verificar `auth.users`, `auth.identities`, perfiles y roles;
- validar MFA/reauthentication administrativa después de la migración.

## Vercel

El proyecto separado ya existe:

- proyecto: `crm`;
- id: `prj_MEFvzc4lfeK6aZAtSnw9ue83gWdS`.

Para el target nuevo deben actualizarse, al menos:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `NEXT_PUBLIC_APP_ENV` cuando corresponda.

La integración disponible en este hilo permite inspección y deploy, pero no escritura autenticada de variables de entorno. Esa modificación queda como gate administrativo de la ventana y nunca debe resolverse escribiendo secretos en Git.

## Doble decisión GO

La política Free-only obliga a distinguir dos decisiones:

### GO-to-cutover

Autoriza iniciar freeze y pausar el legacy. Exige:

- rehearsal real local aprobado;
- CI verde;
- backup tooling validado;
- Vercel candidato listo;
- rollback preparado.

### GO-live

Autoriza abrir operación en el CRM nuevo. Exige, ya sobre el target creado durante la ventana:

- Auth validado;
- transformación/importación completada;
- reconciliación aprobada;
- pedido(s) activos preservados;
- inventario y finanzas sin diferencias no explicadas;
- Preview Vercel conectado al target;
- UAT migrada y smoke aprobados;
- ausencia de errores críticos.

## Rollback

### Antes de abrir escrituras en el CRM nuevo

- no promover a producción;
- restaurar variables Vercel anteriores si fueron cambiadas;
- pausar/eliminar el target nuevo según corresponda;
- restaurar/reanudar el mismo proyecto legacy pausado;
- validar login + operación legacy antes de reabrir.

### Después de abrir escrituras en el CRM nuevo

No ejecutar rollback ciego ni dual-write.

- congelar nuevas escrituras;
- determinar qué escrituras nuevas existen;
- reconciliar/compensar;
- aplicar forward-fix o plan de retorno controlado según evidencia;
- preservar ambos backups y audit trail.

## Acciones que este hilo no ejecuta antes de la ventana

- pausar el proyecto legacy;
- crear el target definitivo consumiendo/liberando cupo;
- modificar variables productivas Vercel;
- cambiar DNS/alias productivo;
- abrir escrituras a usuarios.

Todas afectan usuarios reales y requieren la ventana de cutover con los gates anteriores aprobados.

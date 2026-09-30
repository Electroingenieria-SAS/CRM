# Runbook — Cutover controlado Hilo 15

## Preconditions GO

No ejecutar este runbook hasta que:

- Hilo 14 esté mergeado y certificado;
- `main` esté verde y sin PR funcionales relevantes abiertos;
- backup lógico reciente tenga checksum válido;
- el mismo backup haya sido restaurado y validado en PostgreSQL/Supabase local efímero aislado;
- Preview Vercel del CRM nuevo esté validado;
- variables productivas estén inventariadas;
- rollback frontend/DB/Functions esté preparado;
- MIG-002 y MIG-007 estén cerrados;
- la estrategia `docs/migration/free-slot-cutover.md` esté aprobada para la ventana.

No se exige staging Supabase remoto ni plan pago para cumplir esta precondición.

## Secuencia

1. Comunicar ventana y responsable.
2. Poner CRM legado en modo mantenimiento/read-only para escrituras operativas.
3. Capturar timestamp de freeze.
4. Ejecutar backup lógico final fuera del repositorio.
5. Verificar `SHA256SUMS`.
6. Extraer delta desde el último dry-run, si existe.
7. Con el backup final ya validado, pausar el proyecto legacy para liberar un cupo Free; no eliminarlo.
8. Crear el target Supabase Free definitivo dentro de la ventana.
9. Aplicar migraciones versionadas sobre el target limpio.
10. Migrar Auth/perfiles/roles según `docs/migration/auth-strategy.md`; asumir re-login y validar MFA administrativo.
11. Importar/transformar datasets operativos en orden referencial: organización → perfiles/roles → catálogos → pedidos → finanzas → compras/recepción → inventario → Workforce → logística → históricos seleccionados.
12. Ejecutar reconciliación de conteos, FKs, finanzas, inventario y pedidos activos.
13. Configurar el Preview Vercel para usar el target nuevo mediante variables protegidas; nunca escribir claves en Git.
14. Ejecutar UAT migrada y smoke de login, pedidos, Finance, Inventory, Workforce, Logistics, Dashboard/PACO.
15. Tomar decisión **GO-live / ROLLBACK**.
16. Si GO-live, promover el deployment validado y ejecutar smoke productivo no destructivo.
17. Abrir operación en CRM nuevo.
18. Mantener el CRM antiguo **pausado** durante la coexistencia inicial de rollback; no dual-write.
19. Registrar SHA, proyecto target, fecha, conteos, checksums y responsables.

## Rollback triggers

Rollback inmediato ante:

- login/sesión general rotos;
- RLS con acceso cruzado;
- pedidos activos perdidos o etapa/responsable incorrectos;
- divergencia financiera no explicada;
- inventario inconsistente;
- error masivo en escrituras.

## Rollback

- Frontend: promover deployment Vercel saludable anterior.
- Datos: no revertir DDL con `git revert`; usar forward-fix/compensación o restore verificado.
- Functions: redeploy de versión conocida y verificación JWT/CORS.
- Operación: si el CRM nuevo todavía no recibió escrituras, reanudar el proyecto legacy pausado y validar antes de reabrir. Si el CRM nuevo ya recibió escrituras, congelar, reconciliar y aplicar retorno controlado/forward-fix; nunca dual-write improvisado.

## Doble gate GO

- **GO-to-cutover:** autoriza freeze, backup final y pausa del legacy. Requiere rehearsal real local + CI verde.
- **GO-live:** autoriza abrir usuarios en el target nuevo. Requiere Auth, transformación, reconciliación, Preview y UAT migrada aprobados.

No confundir ambos gates: un GO-to-cutover no autoriza todavía abrir producción nueva.

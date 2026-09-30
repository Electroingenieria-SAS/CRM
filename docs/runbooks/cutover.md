# Runbook — Cutover controlado Hilo 15

## Preconditions GO

No ejecutar este runbook hasta que:

- Hilo 14 esté mergeado y certificado;
- `main` esté verde y sin PR funcionales relevantes abiertos;
- backup lógico reciente tenga checksum válido;
- el mismo backup haya sido restaurado en no-producción y aprobado;
- Preview Vercel del CRM nuevo esté validado;
- variables productivas estén inventariadas;
- rollback frontend/DB/Functions esté preparado;
- MIG-001..MIG-003 estén cerrados.

## Secuencia

1. Comunicar ventana y responsable.
2. Poner CRM legado en modo mantenimiento/read-only para escrituras operativas.
3. Capturar timestamp de freeze.
4. Ejecutar backup lógico final fuera del repositorio.
5. Verificar `SHA256SUMS`.
6. Extraer delta desde el último dry-run, si existe.
7. Aplicar migraciones versionadas en destino.
8. Importar datasets en orden referencial: organización → Auth/perfiles/roles → catálogos → clientes/proyecciones → pedidos → finanzas → compras/recepción → inventario → Workforce → logística → históricos seleccionados.
9. Ejecutar reconciliación de conteos, FKs, finanzas e inventario.
10. Ejecutar smoke de datos migrados: login, pedido, Finance, Inventory, Workforce, Logistics, Dashboard/PACO.
11. Promover el mismo artefacto Vercel Preview validado; no reconstruir otro artefacto si puede usarse `promote`.
12. Ejecutar smoke productivo no destructivo.
13. Si todo está correcto, abrir operación en CRM nuevo.
14. Mantener CRM antiguo en read-only durante coexistencia definida.
15. Registrar SHA, fecha, conteos, checksums y responsables.

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
- Operación: reabrir legado solo si la estrategia de datos confirma que no habrá divergencia; nunca dual-write improvisado.

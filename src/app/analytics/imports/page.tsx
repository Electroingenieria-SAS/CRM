'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  ImportApply,
  ImportList,
  ImportPreview,
} from '@/modules/analytics/application/analytics.schemas';
import { AnalyticsShell } from '../analytics-shell';
import styles from '../analytics.module.css';
import { useAnalyticsSession } from '../use-analytics-session';

function errorMessage(item: Record<string, unknown>) {
  return typeof item.message === 'string' ? item.message : JSON.stringify(item);
}

export default function AnalyticsImportsPage() {
  const session = useAnalyticsSession();
  const [imports, setImports] = useState<ImportList | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportApply | null>(null);
  const [source, setSource] = useState('LEGACY_CRM');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const loadImports = useCallback(async () => {
    if (!session.application || !session.context) return;
    if (!hasModuleCapability(session.context, 'imports', 'read')) return;
    try {
      setImports(await session.application.analytics.imports());
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible cargar las importaciones.',
      );
    }
  }, [session.application, session.context, session.setMessage]);

  useEffect(() => {
    void loadImports();
  }, [loadImports]);

  async function previewFile() {
    if (!session.application || !file) return;
    setBusy(true);
    session.setMessage(null);
    setResult(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
      const text = await file.text();
      setPreview(await session.application.analytics.prepareHistoricalCsv(file.name, text, source));
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible validar la importación.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!session.application || !preview) return;
    setBusy(true);
    session.setMessage(null);
    try {
      setResult(await session.application.analytics.applyImport(preview.batchId));
      await loadImports();
    } catch (error) {
      session.setMessage(
        error instanceof Error ? error.message : 'No fue posible aplicar la importación.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!session.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Históricos</p>
          <h1>{session.loading ? 'Cargando importaciones…' : 'No fue posible abrir importaciones'}</h1>
          {session.message ? <p role="alert">{session.message}</p> : null}
        </section>
      </main>
    );
  }

  const canImport = hasModuleCapability(session.context, 'imports', 'create');

  return (
    <AnalyticsShell context={session.context} current="imports" onSignOut={session.signOut}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Históricos e importaciones</p>
          <h1>Importación segura y trazable</h1>
          <p>
            CSV → preview → staging → normalización → aplicación. Nunca inserta a ciegas en tablas
            operativas.
          </p>
        </div>
      </header>

      {canImport ? (
        <section className={styles.panel} aria-labelledby="import-title">
          <h2 id="import-title">Preparar histórico de etapas</h2>
          <p>
            Política: filas válidas se aplican y las rechazadas permanecen con causa. Repetir el
            mismo archivo usa SHA-256 y no duplica silenciosamente.
          </p>
          <div className={styles.importForm}>
            <label>
              Fuente
              <input
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="LEGACY_CRM"
              />
            </label>
            <label>
              Archivo CSV
              <input
                className={styles.fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className={styles.muted}>
            Encabezados esperados: externalKey, externalOrderKey, orderNumber, clientName,
            sellerReference, routeCode, stepCode, taskCreatedAt, startedAt, completedAt,
            waitingSeconds, processingSeconds, blockedSeconds, transitSeconds.
          </p>
          <div className={styles.importActions}>
            <button
              type="button"
              className="primary-button"
              disabled={!file || busy}
              onClick={() => void previewFile()}
            >
              {busy ? 'Validando…' : 'Validar y previsualizar'}
            </button>
            {preview ? (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={busy || (preview.validRows ?? 0) === 0}
                onClick={() => void apply()}
              >
                Aplicar filas válidas
              </button>
            ) : null}
          </div>

          {session.message ? (
            <p className={styles.message} role="alert">
              {session.message}
            </p>
          ) : null}

          {preview ? (
            <div className={styles.metricGrid} aria-label="Resultado de validación">
              <article className={styles.metric}>
                <small>Total</small>
                <strong>{preview.totalRows}</strong>
              </article>
              <article className={styles.metric}>
                <small>Válidas</small>
                <strong>{preview.validRows ?? 0}</strong>
              </article>
              <article className={styles.metric}>
                <small>Rechazadas</small>
                <strong>{preview.rejectedRows}</strong>
              </article>
              <article className={styles.metric}>
                <small>Idempotente</small>
                <strong>{preview.idempotent ? 'Sí' : 'No'}</strong>
              </article>
            </div>
          ) : null}

          {preview?.errors.length ? (
            <div aria-labelledby="import-errors-title">
              <h3 id="import-errors-title">Errores por fila</h3>
              <div className={styles.importList}>
                {preview.errors.map((row) => (
                  <article className={styles.importCard} key={row.rowNumber}>
                    <strong>Fila {row.rowNumber}</strong>
                    <ul className={styles.errorList}>
                      {row.errors.map((error, index) => (
                        <li key={index}>{errorMessage(error)}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {result ? (
            <p className={styles.message} role="status">
              Lote {result.status}: {result.appliedRows} aplicadas, {result.rejectedRows} rechazadas.
            </p>
          ) : null}
        </section>
      ) : (
        <p className={styles.message}>
          Tu perfil puede revisar trazabilidad de importaciones, pero no cargar históricos.
        </p>
      )}

      <section className={styles.panel} aria-labelledby="import-history-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="import-history-title">Trazabilidad</h2>
            <p>Archivo, fuente, usuario, fecha y resultado quedan registrados por lote.</p>
          </div>
        </div>
        <div className={styles.importList}>
          {(imports?.items ?? []).map((item, index) => (
            <article className={styles.importCard} key={String(item.batchId ?? index)}>
              <div className={styles.rowHeader}>
                <strong>{String(item.fileName ?? 'Archivo')}</strong>
                <span>{String(item.status ?? '—')}</span>
              </div>
              <div className={styles.previewGrid}>
                <span>Fuente: {String(item.source ?? '—')}</span>
                <span>Procesadas: {String(item.appliedRows ?? 0)}</span>
                <span>Rechazadas: {String(item.rejectedRows ?? 0)}</span>
                <span>Usuario: {String(item.createdBy ?? '—')}</span>
              </div>
              <small className={styles.code}>{String(item.checksum ?? '')}</small>
            </article>
          ))}
          {!imports?.items.length ? (
            <p className={styles.muted}>No existen importaciones registradas.</p>
          ) : null}
        </div>
      </section>
    </AnalyticsShell>
  );
}

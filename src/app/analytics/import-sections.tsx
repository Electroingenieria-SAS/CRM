'use client';

import type { ImportApply, ImportList, ImportPreview } from '@/modules/analytics/application/analytics.schemas';
import styles from './analytics.module.css';

function errorMessage(item: Record<string, unknown>) {
  return typeof item.message === 'string' ? item.message : JSON.stringify(item);
}

interface ImportFormProps {
  source: string;
  busy: boolean;
  file: File | null;
  preview: ImportPreview | null;
  result: ImportApply | null;
  message: string | null;
  onSource(value: string): void;
  onFile(file: File | null): void;
  onPreview(): void;
  onApply(): void;
}

export function ImportFormPanel(props: ImportFormProps) {
  return (
    <section className={styles.panel} aria-labelledby="import-title">
      <h2 id="import-title">Preparar histórico de etapas</h2>
      <p>
        Política: filas válidas se aplican y las rechazadas permanecen con causa. Repetir el mismo
        archivo usa SHA-256 y no duplica silenciosamente.
      </p>
      <div className={styles.importForm}>
        <label>
          Fuente
          <input
            value={props.source}
            onChange={(event) => props.onSource(event.target.value)}
            placeholder="LEGACY_CRM"
          />
        </label>
        <label>
          Archivo CSV
          <input
            className={styles.fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => props.onFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <p className={styles.muted}>
        Encabezados esperados: externalKey, externalOrderKey, orderNumber, clientName,
        sellerReference, routeCode, stepCode, taskCreatedAt, startedAt, completedAt, waitingSeconds,
        processingSeconds, blockedSeconds, transitSeconds.
      </p>
      <div className={styles.importActions}>
        <button
          type="button"
          className="primary-button"
          disabled={!props.file || props.busy}
          onClick={props.onPreview}
        >
          {props.busy ? 'Validando…' : 'Validar y previsualizar'}
        </button>
        {props.preview ? (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={props.busy || (props.preview.validRows ?? 0) === 0}
            onClick={props.onApply}
          >
            Aplicar filas válidas
          </button>
        ) : null}
      </div>
      {props.message ? (
        <p className={styles.message} role="alert">
          {props.message}
        </p>
      ) : null}
      {props.preview ? <ImportPreviewSummary preview={props.preview} /> : null}
      {props.preview?.errors.length ? <ImportErrors preview={props.preview} /> : null}
      {props.result ? (
        <p className={styles.message} role="status">
          Lote {props.result.status}: {props.result.appliedRows} aplicadas,{' '}
          {props.result.rejectedRows} rechazadas.
        </p>
      ) : null}
    </section>
  );
}

function ImportPreviewSummary({ preview }: { preview: ImportPreview }) {
  const items = [
    ['Total', preview.totalRows],
    ['Válidas', preview.validRows ?? 0],
    ['Rechazadas', preview.rejectedRows],
    ['Idempotente', preview.idempotent ? 'Sí' : 'No'],
  ] as const;
  return (
    <div className={styles.metricGrid} aria-label="Resultado de validación">
      {items.map(([label, value]) => (
        <article className={styles.metric} key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function ImportErrors({ preview }: { preview: ImportPreview }) {
  return (
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
  );
}

export function ImportHistoryPanel({ imports }: { imports: ImportList | null }) {
  return (
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
  );
}

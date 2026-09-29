'use client';

import { AnalyticsShell } from '../analytics-shell';
import { ImportFormPanel, ImportHistoryPanel } from '../import-sections';
import styles from '../analytics.module.css';
import { useAnalyticsImportsPage } from '../use-analytics-imports-page';

export default function AnalyticsImportsPage() {
  const page = useAnalyticsImportsPage();

  if (!page.context) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface">
          <p className="eyebrow">Históricos</p>
          <h1>{page.loading ? 'Cargando importaciones…' : 'No fue posible abrir importaciones'}</h1>
          {page.message ? <p role="alert">{page.message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <AnalyticsShell context={page.context} current="imports" onSignOut={page.signOut}>
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

      {page.canImport ? (
        <ImportFormPanel
          source={page.source}
          busy={page.busy}
          file={page.file}
          preview={page.preview}
          result={page.result}
          message={page.message}
          onSource={page.setSource}
          onFile={page.setFile}
          onPreview={() => void page.previewFile()}
          onApply={() => void page.apply()}
        />
      ) : (
        <p className={styles.message}>
          Tu perfil puede revisar trazabilidad de importaciones, pero no cargar históricos.
        </p>
      )}

      <ImportHistoryPanel imports={page.imports} />
    </AnalyticsShell>
  );
}

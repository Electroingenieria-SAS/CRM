'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  ImportApply,
  ImportList,
  ImportPreview,
} from '@/modules/analytics/application/analytics.schemas';
import { useAnalyticsSession } from './use-analytics-session';

export function useAnalyticsImportsPage() {
  const session = useAnalyticsSession();
  const { application, context, setMessage } = session;
  const [imports, setImports] = useState<ImportList | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportApply | null>(null);
  const [source, setSource] = useState('LEGACY_CRM');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshImports = useCallback(async () => {
    if (!application || !context || !hasModuleCapability(context, 'imports', 'read')) return;
    const value = await application.analytics.imports();
    setImports(value);
  }, [application, context]);

  useEffect(() => {
    if (!application || !context || !hasModuleCapability(context, 'imports', 'read')) return;
    let active = true;
    void application.analytics
      .imports()
      .then((value) => {
        if (active) setImports(value);
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'No fue posible cargar las importaciones.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [application, context, setMessage]);

  async function previewFile() {
    if (!application || !file) return;
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.');
      const text = await file.text();
      setPreview(await application.analytics.prepareHistoricalCsv(file.name, text, source));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible validar la importación.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!application || !preview) return;
    setBusy(true);
    setMessage(null);
    try {
      setResult(await application.analytics.applyImport(preview.batchId));
      await refreshImports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible aplicar la importación.');
    } finally {
      setBusy(false);
    }
  }

  return {
    ...session,
    imports,
    preview,
    result,
    source,
    setSource,
    file,
    setFile,
    busy,
    previewFile,
    apply,
    canImport: Boolean(context && hasModuleCapability(context, 'imports', 'create')),
  };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsFilters,
  ReportCatalog,
  ReportResponse,
} from '@/modules/analytics/application/analytics.schemas';
import { useAnalyticsSession } from './use-analytics-session';

export type ReportFilters = AnalyticsFilters & { search?: string };

export function useAnalyticsReportsPage() {
  const session = useAnalyticsSession();
  const { application, context, setMessage } = session;
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [reportCode, setReportCode] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [response, setResponse] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(
    async (code: string, page: number, nextFilters: ReportFilters) => {
      if (!application || !code) return;
      setLoading(true);
      setMessage(null);
      try {
        setResponse(await application.analytics.report(code, nextFilters, page, 25));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible consultar el reporte.');
      } finally {
        setLoading(false);
      }
    },
    [application, setMessage],
  );

  useEffect(() => {
    if (!application || !context || !hasModuleCapability(context, 'reports', 'read')) return;
    let active = true;
    void application.analytics
      .reportCatalog()
      .then(async (value) => {
        if (!active) return;
        setCatalog(value);
        const first = value.items[0]?.code ?? '';
        setReportCode(first);
        if (first) {
          const firstResponse = await application.analytics.report(first, {}, 1, 25);
          if (active) setResponse(firstResponse);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'No fue posible cargar los reportes.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [application, context, setMessage]);

  async function exportCurrentPage() {
    if (!application || !response || !reportCode) return;
    setMessage(null);
    try {
      const csv = await application.analytics.exportPage(reportCode, filters, response);
      const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = reportCode + '-' + response.range.from + '-' + response.range.to + '.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible exportar la página.');
    }
  }

  return {
    ...session,
    catalog,
    reportCode,
    setReportCode,
    filters,
    setFilters,
    response,
    loading,
    loadReport,
    exportCurrentPage,
    forbidden: Boolean(context && !hasModuleCapability(context, 'reports', 'read')),
  };
}

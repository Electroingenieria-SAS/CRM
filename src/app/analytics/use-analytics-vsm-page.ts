'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsFilters,
  AnalyticsOrderVsm,
  AnalyticsVsmSummary,
} from '@/modules/analytics/application/analytics.schemas';
import { useAnalyticsSession } from './use-analytics-session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useAnalyticsVsmPage() {
  const session = useAnalyticsSession();
  const { application, context, setMessage } = session;
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [summary, setSummary] = useState<AnalyticsVsmSummary | null>(null);
  const [detail, setDetail] = useState<AnalyticsOrderVsm | null>(null);
  const [lookup, setLookup] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(
    async (next: AnalyticsFilters) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        setSummary(await application.analytics.vsmSummary(next));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible cargar el VSM.');
      } finally {
        setLoading(false);
      }
    },
    [application, setMessage],
  );

  useEffect(() => {
    if (!application || !context || !hasModuleCapability(context, 'vsm', 'read')) return;
    let active = true;
    void application.analytics
      .vsmSummary({})
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible cargar el VSM.');
        }
      });
    return () => {
      active = false;
    };
  }, [application, context, setMessage]);

  async function openOrder() {
    if (!application || !lookup.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const value = lookup.trim();
      setDetail(
        await application.analytics.orderVsm(
          uuidPattern.test(value) ? value : undefined,
          uuidPattern.test(value) ? undefined : value,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible consultar el pedido.');
    } finally {
      setLoading(false);
    }
  }

  return {
    ...session,
    filters,
    setFilters,
    summary,
    detail,
    lookup,
    setLookup,
    loading,
    loadSummary,
    openOrder,
    forbidden: Boolean(context && !hasModuleCapability(context, 'vsm', 'read')),
  };
}

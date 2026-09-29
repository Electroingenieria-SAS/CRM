'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
} from '@/modules/analytics/application/analytics.schemas';
import { useAnalyticsSession } from './use-analytics-session';

export function useAnalyticsDashboardPage() {
  const session = useAnalyticsSession();
  const { application, context, setMessage } = session;
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (nextFilters: AnalyticsFilters) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        setDashboard(await application.analytics.dashboard(nextFilters));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible cargar el panel.');
      } finally {
        setLoading(false);
      }
    },
    [application, setMessage],
  );

  useEffect(() => {
    if (!application || !context || !hasModuleCapability(context, 'dashboard', 'read')) return;
    let active = true;
    void application.analytics
      .dashboard({})
      .then((value) => {
        if (active) setDashboard(value);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible cargar el panel.');
        }
      });
    return () => {
      active = false;
    };
  }, [application, context, setMessage]);

  return {
    ...session,
    filters,
    setFilters,
    dashboard,
    loading,
    load,
    forbidden: Boolean(context && !hasModuleCapability(context, 'dashboard', 'read')),
  };
}

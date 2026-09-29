'use client';

import { useEffect, useMemo } from 'react';
import { createTelemetryBrowserReporter } from '@/composition/telemetry-browser-reporter';
import type { TelemetryPayload } from '@/infrastructure/observability/supabase-observability-reporter';

export function TelemetryBridge() {
  const reporter = useMemo(() => createTelemetryBrowserReporter(), []);

  useEffect(() => {
    if (!reporter) return;

    const handler = (event: Event) => {
      const custom = event as CustomEvent<TelemetryPayload>;
      const detail = custom.detail;
      if (!detail || (detail.level !== 'warn' && detail.level !== 'error')) return;
      void reporter.report(detail).catch(() => undefined);
    };

    window.addEventListener('crm:telemetry', handler);
    return () => window.removeEventListener('crm:telemetry', handler);
  }, [reporter]);

  return null;
}

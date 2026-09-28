'use client';

import { useEffect, useState } from 'react';
import type { WorkforceBrowserApplication } from '@/composition/workforce-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  WorkforceActivityDetailResponse,
  WorkforceCatalogItem,
  WorkforceIndicatorsResponse,
  WorkforceScheduleResponse,
} from '@/modules/workforce/application/workforce.schemas';
import {
  todayBusinessIso,
  workforceRange,
  type WorkforceCalendarMode,
} from '@/modules/workforce/ui/workforce-range';

async function loadInitialWorkspace(application: WorkforceBrowserApplication) {
  const context = await application.auth.restoreContext();
  if (!context) return null;
  if (!hasModuleCapability(context, 'workforce', 'read')) {
    throw new Error('No tienes permiso para consultar Workforce.');
  }

  const anchor = todayBusinessIso();
  const range = workforceRange('day', anchor);
  const [catalog, schedule, indicators] = await Promise.all([
    application.workforce.catalog(),
    application.workforce.schedule(range.from, range.to),
    application.workforce.indicators(range.from, range.to),
  ]);
  return { context, anchor, catalog: catalog.items, schedule, indicators };
}

export function useWorkforceState(
  application: WorkforceBrowserApplication | null,
  goToLogin: () => void,
) {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [catalog, setCatalog] = useState<WorkforceCatalogItem[]>([]);
  const [schedule, setSchedule] = useState<WorkforceScheduleResponse | null>(null);
  const [indicators, setIndicators] = useState<WorkforceIndicatorsResponse | null>(null);
  const [detail, setDetail] = useState<WorkforceActivityDetailResponse | null>(null);
  const [mode, setMode] = useState<WorkforceCalendarMode>('day');
  const [anchor, setAnchor] = useState(todayBusinessIso);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') goToLogin();
    });

    void loadInitialWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) return goToLogin();
        setContext(workspace.context);
        setAnchor(workspace.anchor);
        setCatalog(workspace.catalog);
        setSchedule(workspace.schedule);
        setIndicators(workspace.indicators);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Workforce.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, goToLogin]);

  return {
    context, catalog, schedule, indicators, detail, mode, anchor, creating, loading, busy,
    message, notice, setSchedule, setIndicators, setDetail, setMode, setAnchor, setCreating,
    setLoading, setBusy, setMessage, setNotice,
  };
}

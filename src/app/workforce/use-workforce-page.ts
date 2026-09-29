'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  createWorkforceBrowserApplication,
  type WorkforceBrowserApplication,
} from '@/composition/workforce-browser-application';
import {
  navigateWorkforceAnchor,
  todayBusinessIso,
  workforceRange,
  type WorkforceCalendarMode,
} from '@/modules/workforce/ui/workforce-range';
import { createWorkforcePageActions } from './workforce-page-actions';
import { useWorkforceState } from './use-workforce-state';

async function loadPeriodData(
  application: WorkforceBrowserApplication,
  mode: WorkforceCalendarMode,
  anchor: string,
) {
  const range = workforceRange(mode, anchor);
  const [schedule, indicators] = await Promise.all([
    application.workforce.schedule(range.from, range.to),
    application.workforce.indicators(range.from, range.to),
  ]);
  return { schedule, indicators };
}

export function useWorkforcePage() {
  const router = useRouter();
  const application = useMemo(() => createWorkforceBrowserApplication(), []);
  const goToLogin = useCallback(() => router.replace('/login'), [router]);
  const state = useWorkforceState(application, goToLogin);
  const {
    context,
    detail,
    mode,
    anchor,
    setSchedule,
    setIndicators,
    setMode,
    setAnchor,
    setLoading,
    setMessage,
  } = state;

  const loadPeriod = useCallback(
    async (nextMode: WorkforceCalendarMode, nextAnchor: string) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      try {
        const data = await loadPeriodData(application, nextMode, nextAnchor);
        setMode(nextMode);
        setAnchor(nextAnchor);
        setSchedule(data.schedule);
        setIndicators(data.indicators);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible actualizar el cronograma.',
        );
      } finally {
        setLoading(false);
      }
    },
    [application, setAnchor, setIndicators, setLoading, setMessage, setMode, setSchedule],
  );

  const reloadCurrent = useCallback(async () => {
    if (!application) return;
    const data = await loadPeriodData(application, mode, anchor);
    setSchedule(data.schedule);
    setIndicators(data.indicators);
  }, [application, anchor, mode, setIndicators, setSchedule]);

  const actions = createWorkforcePageActions({
    application,
    context,
    detail,
    reloadCurrent,
    setDetail: state.setDetail,
    setCreating: state.setCreating,
    setBusy: state.setBusy,
    setMessage: state.setMessage,
    setNotice: state.setNotice,
    goToLogin,
  });

  return {
    ...state,
    loading: application ? state.loading : false,
    message: application
      ? state.message
      : 'Este entorno no tiene un backend de staging configurado.',
    setMode: (next: WorkforceCalendarMode) => void loadPeriod(next, anchor),
    navigate: (direction: -1 | 1) =>
      void loadPeriod(mode, navigateWorkforceAnchor(mode, anchor, direction)),
    goToday: () => void loadPeriod(mode, todayBusinessIso()),
    ...actions,
  };
}

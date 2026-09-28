'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createWorkforceBrowserApplication,
  type WorkforceBrowserApplication,
} from '@/composition/workforce-browser-application';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreateWorkforceActivityInput,
  WorkforceActivityDetailResponse,
  WorkforceCatalogItem,
  WorkforceIndicatorsResponse,
  WorkforceScheduleResponse,
} from '@/modules/workforce/application/workforce.schemas';
import {
  navigateWorkforceAnchor,
  todayBusinessIso,
  workforceRange,
  type WorkforceCalendarMode,
} from '@/modules/workforce/ui/workforce-range';

async function initialWorkspace(application: WorkforceBrowserApplication) {
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

export function useWorkforcePage() {
  const router = useRouter();
  const application = useMemo(() => createWorkforceBrowserApplication(), []);
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
  const goToLogin = useCallback(() => router.replace('/login'), [router]);

  useEffect(() => {
    if (!application) return;
    let active = true;
    const unsubscribe = application.auth.onSessionChange((event) => {
      if (event.type === 'signed_out') goToLogin();
    });

    void initialWorkspace(application)
      .then((workspace) => {
        if (!active) return;
        if (!workspace) {
          goToLogin();
          return;
        }
        setContext(workspace.context);
        setAnchor(workspace.anchor);
        setCatalog(workspace.catalog);
        setSchedule(workspace.schedule);
        setIndicators(workspace.indicators);
      })
      .catch((error) => {
        if (active)
          setMessage(error instanceof Error ? error.message : 'No fue posible abrir Workforce.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [application, goToLogin]);

  const loadPeriod = useCallback(
    async (nextMode: WorkforceCalendarMode, nextAnchor: string) => {
      if (!application) return;
      setLoading(true);
      setMessage(null);
      const range = workforceRange(nextMode, nextAnchor);
      try {
        const [nextSchedule, nextIndicators] = await Promise.all([
          application.workforce.schedule(range.from, range.to),
          application.workforce.indicators(range.from, range.to),
        ]);
        setMode(nextMode);
        setAnchor(nextAnchor);
        setSchedule(nextSchedule);
        setIndicators(nextIndicators);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible actualizar el cronograma.',
        );
      } finally {
        setLoading(false);
      }
    },
    [application],
  );

  const reloadCurrent = useCallback(async () => {
    if (!application) return;
    const range = workforceRange(mode, anchor);
    const [nextSchedule, nextIndicators] = await Promise.all([
      application.workforce.schedule(range.from, range.to),
      application.workforce.indicators(range.from, range.to),
    ]);
    setSchedule(nextSchedule);
    setIndicators(nextIndicators);
  }, [application, mode, anchor]);

  const refreshDetail = useCallback(
    async (activityId: string) => {
      if (!application) return;
      setDetail(await application.workforce.detail(activityId));
    },
    [application],
  );

  async function mutate(
    activityId: string,
    operation: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
      await Promise.all([reloadCurrent(), refreshDetail(activityId)]);
      setNotice(successMessage);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No fue posible actualizar la actividad.',
      );
    } finally {
      setBusy(false);
    }
  }

  const version = detail?.activity.version ?? 0;
  const activityId = detail?.activity.id ?? '';

  return {
    context,
    catalog,
    schedule,
    indicators,
    detail,
    mode,
    anchor,
    creating,
    loading: application ? loading : false,
    busy,
    message: application ? message : 'Este entorno no tiene un backend de staging configurado.',
    notice,
    setCreating,
    setDetail,
    setMode: (next: WorkforceCalendarMode) => void loadPeriod(next, anchor),
    navigate: (direction: -1 | 1) =>
      void loadPeriod(mode, navigateWorkforceAnchor(mode, anchor, direction)),
    goToday: () => void loadPeriod(mode, todayBusinessIso()),
    create: async (input: CreateWorkforceActivityInput) => {
      if (!application) return;
      setBusy(true);
      setMessage(null);
      try {
        await application.workforce.create(input, crypto.randomUUID());
        setCreating(false);
        await reloadCurrent();
        setNotice('Actividad planificada correctamente.');
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'No fue posible planificar la actividad.',
        );
      } finally {
        setBusy(false);
      }
    },
    openDetail: async (id: string) => {
      if (!application) return;
      try {
        setDetail(await application.workforce.detail(id));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No fue posible abrir la actividad.');
      }
    },
    assign: (profileId: string | null) =>
      mutate(
        activityId,
        () => application!.workforce.assign(activityId, profileId, version, crypto.randomUUID()),
        'Responsable actualizado.',
      ),
    start: () =>
      mutate(
        activityId,
        () => application!.workforce.start(activityId, version, crypto.randomUUID()),
        'Actividad iniciada.',
      ),
    block: (reason: string) =>
      mutate(
        activityId,
        () => application!.workforce.block(activityId, reason, version, crypto.randomUUID()),
        'Actividad bloqueada.',
      ),
    resume: () =>
      mutate(
        activityId,
        () => application!.workforce.resume(activityId, version, crypto.randomUUID()),
        'Actividad reanudada.',
      ),
    complete: (resultNote: string) =>
      mutate(
        activityId,
        () => application!.workforce.complete(activityId, resultNote, version, crypto.randomUUID()),
        'Actividad finalizada.',
      ),
    cancel: (reason: string) =>
      mutate(
        activityId,
        () => application!.workforce.cancel(activityId, reason, version, crypto.randomUUID()),
        'Actividad cancelada.',
      ),
    upload: async (
      file: File,
      evidenceType: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE',
    ) => {
      if (!application || !context || !detail) return;
      await mutate(
        detail.activity.id,
        () =>
          application.workforce.uploadEvidence({
            organizationId: context.organization.id,
            activityId: detail.activity.id,
            evidenceType,
            file,
            idempotencyKey: crypto.randomUUID(),
          }),
        'Evidencia registrada.',
      );
    },
    signOut: async () => {
      await application?.auth.signOut();
      goToLogin();
    },
  };
}

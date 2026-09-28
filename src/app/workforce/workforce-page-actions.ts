'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { WorkforceBrowserApplication } from '@/composition/workforce-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreateWorkforceActivityInput,
  WorkforceActivityDetailResponse,
} from '@/modules/workforce/application/workforce.schemas';

interface ActionDependencies {
  application: WorkforceBrowserApplication | null;
  context: SessionContext | null;
  detail: WorkforceActivityDetailResponse | null;
  reloadCurrent(): Promise<void>;
  setDetail: Dispatch<SetStateAction<WorkforceActivityDetailResponse | null>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  goToLogin(): void;
}

type MutationRunner = (
  activityId: string,
  operation: () => Promise<unknown>,
  successMessage: string,
) => Promise<void>;

function mutationRunner(deps: ActionDependencies): MutationRunner {
  return async (activityId, operation, successMessage) => {
    deps.setBusy(true);
    deps.setMessage(null);
    try {
      await operation();
      const detail = await deps.application?.workforce.detail(activityId);
      await deps.reloadCurrent();
      if (detail) deps.setDetail(detail);
      deps.setNotice(successMessage);
    } catch (error) {
      deps.setMessage(
        error instanceof Error ? error.message : 'No fue posible actualizar la actividad.',
      );
    } finally {
      deps.setBusy(false);
    }
  };
}

function lifecycleActions(
  deps: ActionDependencies,
  mutate: MutationRunner,
  activityId: string,
  version: number,
) {
  const workforce = deps.application?.workforce;
  return {
    assign: (profileId: string | null) =>
      mutate(
        activityId,
        () => workforce!.assign(activityId, profileId, version, crypto.randomUUID()),
        'Responsable actualizado.',
      ),
    start: () =>
      mutate(
        activityId,
        () => workforce!.start(activityId, version, crypto.randomUUID()),
        'Actividad iniciada.',
      ),
    block: (reason: string) =>
      mutate(
        activityId,
        () => workforce!.block(activityId, reason, version, crypto.randomUUID()),
        'Actividad bloqueada.',
      ),
    resume: () =>
      mutate(
        activityId,
        () => workforce!.resume(activityId, version, crypto.randomUUID()),
        'Actividad reanudada.',
      ),
    complete: (resultNote: string) =>
      mutate(
        activityId,
        () => workforce!.complete(activityId, resultNote, version, crypto.randomUUID()),
        'Actividad finalizada.',
      ),
    cancel: (reason: string) =>
      mutate(
        activityId,
        () => workforce!.cancel(activityId, reason, version, crypto.randomUUID()),
        'Actividad cancelada.',
      ),
  };
}

export function createWorkforcePageActions(deps: ActionDependencies) {
  const mutate = mutationRunner(deps);
  const activityId = deps.detail?.activity.id ?? '';
  const version = deps.detail?.activity.version ?? 0;

  return {
    create: async (input: CreateWorkforceActivityInput) => {
      if (!deps.application) return;
      deps.setBusy(true);
      deps.setMessage(null);
      try {
        await deps.application.workforce.create(input, crypto.randomUUID());
        deps.setCreating(false);
        await deps.reloadCurrent();
        deps.setNotice('Actividad planificada correctamente.');
      } catch (error) {
        deps.setMessage(
          error instanceof Error ? error.message : 'No fue posible planificar la actividad.',
        );
      } finally {
        deps.setBusy(false);
      }
    },
    openDetail: async (id: string) => {
      if (!deps.application) return;
      try {
        deps.setDetail(await deps.application.workforce.detail(id));
      } catch (error) {
        deps.setMessage(
          error instanceof Error ? error.message : 'No fue posible abrir la actividad.',
        );
      }
    },
    upload: async (
      file: File,
      evidenceType: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE',
    ) => {
      if (!deps.application || !deps.context || !deps.detail) return;
      await mutate(
        deps.detail.activity.id,
        () =>
          deps.application!.workforce.uploadEvidence({
            organizationId: deps.context!.organization.id,
            activityId: deps.detail!.activity.id,
            evidenceType,
            file,
            idempotencyKey: crypto.randomUUID(),
          }),
        'Evidencia registrada.',
      );
    },
    signOut: async () => {
      await deps.application?.auth.signOut();
      deps.goToLogin();
    },
    ...lifecycleActions(deps, mutate, activityId, version),
  };
}

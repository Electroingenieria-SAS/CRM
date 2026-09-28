'use client';

import { useCallback, useState } from 'react';
import type { BrowserApplication } from '@/composition/browser-application';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';

interface Dependencies {
  application: BrowserApplication | null;
  detail: OrderDetailResponse | null;
  reloadOrder(orderId: string): Promise<void>;
  reloadList(): Promise<void>;
  showMessage(message: string | null): void;
  showNotice(message: string | null): void;
}

type MutationRunner = (
  operation: (application: BrowserApplication, detail: OrderDetailResponse) => Promise<unknown>,
  success: string,
) => Promise<void>;

function createSimpleAction(run: MutationRunner) {
  return (action: 'CLAIM' | 'START' | 'COMPLETE') =>
    run(
      (app, detail) => {
        const key = crypto.randomUUID();
        if (action === 'CLAIM') return app.orderWorkflow.claim(detail.order.id, detail.order.version, key);
        if (action === 'START') return app.orderWorkflow.start(detail.order.id, detail.order.version, key);
        return app.orderWorkflow.complete(
          detail.order.id,
          'COMPLETED',
          '',
          detail.order.version,
          key,
        );
      },
      action === 'CLAIM'
        ? 'Tarea tomada correctamente.'
        : action === 'START'
          ? 'Trabajo iniciado.'
          : 'Etapa completada y workflow actualizado.',
    );
}

function createWorkflowCallbacks(run: MutationRunner) {
  const key = () => crypto.randomUUID();

  return {
    simpleAction: createSimpleAction(run),
    assign: (profileId: string) =>
      run(
        (app, detail) =>
          app.orderWorkflow.assign(detail.order.id, profileId, detail.order.version, key()),
        'Responsable actualizado.',
      ),
    block: (reasonCode: string, detailText: string) =>
      run(
        (app, detail) =>
          app.orderWorkflow.block(
            detail.order.id,
            { reasonCode, detail: detailText },
            detail.order.version,
            key(),
          ),
        'Bloqueo registrado.',
      ),
    resume: (resolution: string) =>
      run(
        (app, detail) =>
          app.orderWorkflow.resume(detail.order.id, resolution, detail.order.version, key()),
        'Bloqueo resuelto y trabajo reanudado.',
      ),
    createIssue: (input: unknown) =>
      run(
        (app, detail) => app.orderWorkflow.createIssue(detail.order.id, input, key()),
        'Incidencia registrada.',
      ),
    addEvidence: (input: unknown) =>
      run(
        (app, detail) => app.orderWorkflow.addEvidence(detail.order.id, input, key()),
        'Evidencia registrada.',
      ),
    cancel: (reason: string) =>
      run(
        (app, detail) =>
          app.orderWorkflow.cancel(detail.order.id, reason, detail.order.version, key()),
        'Pedido cancelado con trazabilidad.',
      ),
    reopen: (targetStep: string, reason: string) =>
      run(
        (app, detail) =>
          app.orderWorkflow.reopen(
            detail.order.id,
            targetStep,
            reason,
            detail.order.version,
            key(),
          ),
        'Pedido reabierto.',
      ),
    resolveIssue: (issueId: string, resolution: string) =>
      run(
        (app) => app.orderWorkflow.resolveIssue(issueId, resolution, key()),
        'Incidencia resuelta.',
      ),
  };
}

export function useOrderWorkflowActions(dependencies: Dependencies) {
  const [workflowBusy, setWorkflowBusy] = useState(false);

  const run = useCallback<MutationRunner>(
    async (operation, success) => {
      const { application, detail } = dependencies;
      if (!application || !detail) return;

      setWorkflowBusy(true);
      dependencies.showMessage(null);
      dependencies.showNotice(null);

      try {
        await operation(application, detail);
        await Promise.all([dependencies.reloadOrder(detail.order.id), dependencies.reloadList()]);
        dependencies.showNotice(success);
      } catch (error) {
        dependencies.showMessage(
          error instanceof Error ? error.message : 'No fue posible completar la operación.',
        );
      } finally {
        setWorkflowBusy(false);
      }
    },
    [dependencies],
  );

  return { workflowBusy, ...createWorkflowCallbacks(run) };
}

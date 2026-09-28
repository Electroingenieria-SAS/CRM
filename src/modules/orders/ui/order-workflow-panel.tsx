'use client';

import { useMemo } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import { OrderEvidencePanel } from '@/modules/orders/ui/order-evidence-panel';
import { OrderIssuesPanel } from '@/modules/orders/ui/order-issues-panel';
import { OrderLifecyclePanel } from '@/modules/orders/ui/order-lifecycle-panel';
import { OrderTaskControls } from '@/modules/orders/ui/order-task-controls';
import styles from './order-workflow-panel.module.css';

export interface WorkflowPanelProps {
  detail: OrderDetailResponse;
  busy: boolean;
  onSimpleAction(action: 'CLAIM' | 'START' | 'COMPLETE'): Promise<void>;
  onAssign(profileId: string): Promise<void>;
  onBlock(reasonCode: string, detail: string): Promise<void>;
  onResume(resolution: string): Promise<void>;
  onCreateIssue(input: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blocking: boolean;
    title: string;
    description: string;
  }): Promise<void>;
  onAddEvidence(input: {
    evidenceType: string;
    storageReference: string;
    fileName?: string;
  }): Promise<void>;
  onCancel(reason: string): Promise<void>;
  onReopen(targetStep: string, reason: string): Promise<void>;
  onResolveIssue(issueId: string, resolution: string): Promise<void>;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function OrderWorkflowPanel(props: WorkflowPanelProps) {
  const activeTask = useMemo(
    () =>
      [...props.detail.tasks]
        .reverse()
        .find((task) =>
          ['QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'BLOCKED'].includes(text(task.status)),
        ),
    [props.detail.tasks],
  );

  return (
    <section className={styles.panel} aria-labelledby="workflow-title">
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Workflow operativo</p>
          <h3 id="workflow-title">Gestión de la tarea activa</h3>
        </div>
        <span className={styles.status}>{activeTask ? text(activeTask.status) : 'SIN TAREA'}</span>
      </header>
      {activeTask ? (
        <dl className={styles.taskSummary}>
          <div><dt>Etapa</dt><dd>{text(activeTask.step_code)}</dd></div>
          <div><dt>Responsable</dt><dd>{text(activeTask.assigned_profile_id) || 'Disponible'}</dd></div>
          <div><dt>Secuencia</dt><dd>{String(activeTask.sequence_no ?? '—')}</dd></div>
        </dl>
      ) : null}
      <div className={styles.primaryActions}>
        {(['CLAIM', 'START', 'COMPLETE'] as const).map((code) => {
          const available = props.detail.workflow.actions.find((item) => item.code === code);
          return available ? (
            <button
              key={code}
              type="button"
              disabled={props.busy || !available.enabled}
              title={available.reason ?? undefined}
              onClick={() => props.onSimpleAction(code)}
            >
              {available.label}
            </button>
          ) : null;
        })}
      </div>
      {props.detail.workflow.missingRequirements.length > 0 ? (
        <div className={styles.warning} role="status">
          <strong>Faltan requisitos para completar.</strong>
          <span>{props.detail.workflow.missingRequirements.length} requisito(s) pendiente(s).</span>
        </div>
      ) : null}
      <OrderTaskControls
        detail={props.detail}
        busy={props.busy}
        onAssign={props.onAssign}
        onBlock={props.onBlock}
        onResume={props.onResume}
      />
      <OrderIssuesPanel
        detail={props.detail}
        busy={props.busy}
        onCreateIssue={props.onCreateIssue}
        onResolveIssue={props.onResolveIssue}
      />
      <OrderEvidencePanel detail={props.detail} busy={props.busy} onAddEvidence={props.onAddEvidence} />
      <OrderLifecyclePanel
        detail={props.detail}
        busy={props.busy}
        onCancel={props.onCancel}
        onReopen={props.onReopen}
      />
    </section>
  );
}

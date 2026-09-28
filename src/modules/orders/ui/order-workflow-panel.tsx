'use client';

import { useMemo, useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import { OrderEvidencePanel } from '@/modules/orders/ui/order-evidence-panel';
import { OrderIssuesPanel } from '@/modules/orders/ui/order-issues-panel';
import { OrderLifecyclePanel } from '@/modules/orders/ui/order-lifecycle-panel';
import styles from './order-workflow-panel.module.css';

interface WorkflowPanelProps {
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

function action(detail: OrderDetailResponse, code: string) {
  return detail.workflow.actions.find((item) => item.code === code);
}

export function OrderWorkflowPanel(props: WorkflowPanelProps) {
  const [blockReason, setBlockReason] = useState(props.detail.workflow.blockReasons[0]?.code ?? '');
  const [blockDetail, setBlockDetail] = useState('');
  const [resolution, setResolution] = useState('');
  const [assignee, setAssignee] = useState('');

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
          <div>
            <dt>Etapa</dt>
            <dd>{text(activeTask.step_code)}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{text(activeTask.assigned_profile_id) || 'Disponible'}</dd>
          </div>
          <div>
            <dt>Secuencia</dt>
            <dd>{String(activeTask.sequence_no ?? '—')}</dd>
          </div>
        </dl>
      ) : null}

      <div className={styles.primaryActions}>
        {(['CLAIM', 'START', 'COMPLETE'] as const).map((code) => {
          const available = action(props.detail, code);
          if (!available) return null;
          return (
            <button
              key={code}
              type="button"
              disabled={props.busy || !available.enabled}
              title={available.reason ?? undefined}
              onClick={() => props.onSimpleAction(code)}
            >
              {available.label}
            </button>
          );
        })}
      </div>

      {props.detail.workflow.missingRequirements.length > 0 ? (
        <div className={styles.warning} role="status">
          <strong>Faltan requisitos para completar.</strong>
          <span>{props.detail.workflow.missingRequirements.length} requisito(s) pendiente(s).</span>
        </div>
      ) : null}

      {action(props.detail, 'ASSIGN') ? (
        <details className={styles.actionBox}>
          <summary>Asignar responsable</summary>
          <label>
            Responsable
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Seleccionar…</option>
              {props.detail.assignmentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.roles.join(', ')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={props.busy || !assignee}
            onClick={() => props.onAssign(assignee)}
          >
            Confirmar asignación
          </button>
        </details>
      ) : null}

      {action(props.detail, 'BLOCK') ? (
        <details className={styles.actionBox}>
          <summary>Bloquear tarea</summary>
          <label>
            Motivo
            <select value={blockReason} onChange={(event) => setBlockReason(event.target.value)}>
              {props.detail.workflow.blockReasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observación
            <textarea value={blockDetail} onChange={(event) => setBlockDetail(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || !blockReason || blockDetail.trim().length < 3}
            onClick={() => props.onBlock(blockReason, blockDetail)}
          >
            Registrar bloqueo
          </button>
        </details>
      ) : null}

      {action(props.detail, 'RESUME') ? (
        <details className={styles.actionBox}>
          <summary>Resolver bloqueo y reanudar</summary>
          <label>
            Resolución
            <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || resolution.trim().length < 3}
            onClick={() => props.onResume(resolution)}
          >
            Resolver y reanudar
          </button>
        </details>
      ) : null}

      <OrderIssuesPanel
        detail={props.detail}
        busy={props.busy}
        onCreateIssue={props.onCreateIssue}
        onResolveIssue={props.onResolveIssue}
      />
      <OrderEvidencePanel
        detail={props.detail}
        busy={props.busy}
        onAddEvidence={props.onAddEvidence}
      />
      <OrderLifecyclePanel
        detail={props.detail}
        busy={props.busy}
        onCancel={props.onCancel}
        onReopen={props.onReopen}
      />
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
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
  const [blockReason, setBlockReason] = useState('OTHER');
  const [blockDetail, setBlockDetail] = useState('');
  const [resolution, setResolution] = useState('');
  const [assignee, setAssignee] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueBlocking, setIssueBlocking] = useState(false);
  const [evidenceReference, setEvidenceReference] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [reopenStep, setReopenStep] = useState('RECEPCION_PEDIDO');
  const [reopenReason, setReopenReason] = useState('');

  const activeTask = useMemo(
    () =>
      [...props.detail.tasks]
        .reverse()
        .find((task) =>
          ['QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'BLOCKED'].includes(text(task.status)),
        ),
    [props.detail.tasks],
  );

  const openIssues = props.detail.issues.filter((item) => text(item.status) === 'OPEN');

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
              <option value="MATERIAL">Falta de material</option>
              <option value="APPROVAL">Espera de aprobación</option>
              <option value="INCOMPLETE_INFORMATION">Información incompleta</option>
              <option value="PAYMENT">Pago</option>
              <option value="SUPPLIER">Proveedor</option>
              <option value="MACHINE">Máquina o equipo</option>
              <option value="CUSTOMER">Cliente</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label>
            Observación
            <textarea value={blockDetail} onChange={(event) => setBlockDetail(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || blockDetail.trim().length < 3}
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

      <details className={styles.actionBox}>
        <summary>Registrar incidencia</summary>
        <label>
          Título
          <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} />
        </label>
        <label>
          Descripción
          <textarea
            value={issueDescription}
            onChange={(event) => setIssueDescription(event.target.value)}
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={issueBlocking}
            onChange={(event) => setIssueBlocking(event.target.checked)}
          />
          Incidencia bloqueante
        </label>
        <button
          type="button"
          disabled={props.busy || issueTitle.trim().length < 3 || issueDescription.trim().length < 3}
          onClick={() =>
            props.onCreateIssue({
              type: 'NOVELTY',
              severity: issueBlocking ? 'HIGH' : 'MEDIUM',
              blocking: issueBlocking,
              title: issueTitle,
              description: issueDescription,
            })
          }
        >
          Guardar incidencia
        </button>
      </details>

      <details className={styles.actionBox}>
        <summary>Agregar evidencia</summary>
        <label>
          Referencia del archivo
          <input
            value={evidenceReference}
            onChange={(event) => setEvidenceReference(event.target.value)}
            placeholder="ID o referencia segura del archivo"
          />
        </label>
        <button
          type="button"
          disabled={props.busy || !evidenceReference.trim()}
          onClick={() =>
            props.onAddEvidence({
              evidenceType:
                props.detail.order.current_step_code === 'CLOSURE' ? 'CLOSURE_PROOF' : 'OPERATIONAL',
              storageReference: evidenceReference,
            })
          }
        >
          Registrar evidencia
        </button>
      </details>

      {openIssues.length > 0 ? (
        <section className={styles.issues}>
          <h4>Incidencias abiertas</h4>
          {openIssues.map((issue) => (
            <article key={text(issue.id)}>
              <div>
                <strong>{text(issue.title)}</strong>
                <span>{text(issue.severity)}</span>
              </div>
              <p>{text(issue.description)}</p>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => {
                  const answer = window.prompt('Describe la resolución aplicada:');
                  if (answer?.trim()) void props.onResolveIssue(text(issue.id), answer);
                }}
              >
                Resolver
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {action(props.detail, 'CANCEL') ? (
        <details className={styles.dangerBox}>
          <summary>Cancelar pedido</summary>
          <label>
            Razón
            <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || cancelReason.trim().length < 3}
            onClick={() => props.onCancel(cancelReason)}
          >
            Confirmar cancelación
          </button>
        </details>
      ) : null}

      {action(props.detail, 'REOPEN') ? (
        <details className={styles.actionBox}>
          <summary>Reabrir pedido</summary>
          <label>
            Etapa de retorno
            <select value={reopenStep} onChange={(event) => setReopenStep(event.target.value)}>
              <option value="RECEPCION_PEDIDO">Recepción del pedido</option>
              <option value="ALISTAMIENTO">Alistamiento</option>
              <option value="FACTURACION">Facturación</option>
              <option value="CLOSURE">Cierre</option>
            </select>
          </label>
          <label>
            Razón
            <textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={props.busy || reopenReason.trim().length < 3}
            onClick={() => props.onReopen(reopenStep, reopenReason)}
          >
            Reabrir
          </button>
        </details>
      ) : null}
    </section>
  );
}

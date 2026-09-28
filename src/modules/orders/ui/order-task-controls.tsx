'use client';

import { useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import styles from './order-workflow-panel.module.css';

interface Props {
  detail: OrderDetailResponse;
  busy: boolean;
  onAssign(profileId: string): Promise<void>;
  onBlock(reasonCode: string, detail: string): Promise<void>;
  onResume(resolution: string): Promise<void>;
}

function action(detail: OrderDetailResponse, code: string) {
  return detail.workflow.actions.find((item) => item.code === code);
}

export function OrderTaskControls({ detail, busy, onAssign, onBlock, onResume }: Props) {
  const [assignee, setAssignee] = useState('');
  const [blockReason, setBlockReason] = useState(detail.workflow.blockReasons[0]?.code ?? '');
  const [blockDetail, setBlockDetail] = useState('');
  const [resolution, setResolution] = useState('');

  return (
    <>
      {action(detail, 'ASSIGN') ? (
        <details className={styles.actionBox}>
          <summary>Asignar responsable</summary>
          <label>
            Responsable
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Seleccionar…</option>
              {detail.assignmentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.roles.join(', ')}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy || !assignee} onClick={() => onAssign(assignee)}>
            Confirmar asignación
          </button>
        </details>
      ) : null}

      {action(detail, 'BLOCK') ? (
        <details className={styles.actionBox}>
          <summary>Bloquear tarea</summary>
          <label>
            Motivo
            <select value={blockReason} onChange={(event) => setBlockReason(event.target.value)}>
              {detail.workflow.blockReasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observación
            <textarea
              value={blockDetail}
              onChange={(event) => setBlockDetail(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !blockReason || blockDetail.trim().length < 3}
            onClick={() => onBlock(blockReason, blockDetail)}
          >
            Registrar bloqueo
          </button>
        </details>
      ) : null}

      {action(detail, 'RESUME') ? (
        <details className={styles.actionBox}>
          <summary>Resolver bloqueo y reanudar</summary>
          <label>
            Resolución
            <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || resolution.trim().length < 3}
            onClick={() => onResume(resolution)}
          >
            Resolver y reanudar
          </button>
        </details>
      ) : null}
    </>
  );
}

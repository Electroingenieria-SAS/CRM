'use client';

import { useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import styles from './order-workflow-panel.module.css';

interface Props {
  detail: OrderDetailResponse;
  busy: boolean;
  onCancel(reason: string): Promise<void>;
  onReopen(targetStep: string, reason: string): Promise<void>;
}

function hasAction(detail: OrderDetailResponse, code: string) {
  return detail.workflow.actions.some((item) => item.code === code);
}

export function OrderLifecyclePanel({ detail, busy, onCancel, onReopen }: Props) {
  const [cancelReason, setCancelReason] = useState('');
  const [reopenStep, setReopenStep] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const selectedStep = reopenStep || detail.workflow.reopenCandidates[0]?.code || '';

  return (
    <>
      {hasAction(detail, 'CANCEL') ? (
        <details className={styles.dangerBox}>
          <summary>Cancelar pedido</summary>
          <label>
            Razón
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || cancelReason.trim().length < 3}
            onClick={() => onCancel(cancelReason)}
          >
            Confirmar cancelación
          </button>
        </details>
      ) : null}

      {hasAction(detail, 'REOPEN') ? (
        <details className={styles.actionBox}>
          <summary>Reabrir pedido</summary>
          <label>
            Etapa de retorno
            <select value={selectedStep} onChange={(event) => setReopenStep(event.target.value)}>
              {detail.workflow.reopenCandidates.map((step) => (
                <option key={step.code} value={step.code}>
                  {step.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Razón
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !selectedStep || reopenReason.trim().length < 3}
            onClick={() => onReopen(selectedStep, reopenReason)}
          >
            Reabrir
          </button>
        </details>
      ) : null}
    </>
  );
}

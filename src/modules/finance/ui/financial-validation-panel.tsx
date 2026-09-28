'use client';

import { useState } from 'react';
import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import type { FinanceDomain } from '@/modules/finance/ports/finance-repository';
import styles from './finance-ui.module.css';

interface FinancialValidationPanelProps {
  domain: FinanceDomain;
  summary: OrderFinancialSummary;
  canUpdate: boolean;
  onValidate(result: 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW', reason: string): Promise<void>;
  onHold(reasonCode: string, reason: string, requiresApproval: boolean): Promise<void>;
  onRelease(holdId: string, reason: string): Promise<void>;
  onRequestException(holdId: string, reason: string): Promise<void>;
}

export function FinancialValidationPanel(props: FinancialValidationPanelProps) {
  const [reason, setReason] = useState('');
  const [holdCode, setHoldCode] = useState(props.domain === 'CARTERA' ? 'OVERDUE_EXTERNAL' : 'PAYMENT_REVIEW');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const activeHold = props.summary.activeHolds[0];

  return (
    <section className={styles.panel} aria-labelledby="financial-decision-title">
      <h3 id="financial-decision-title">Decisión de {props.domain === 'CARTERA' ? 'Cartera' : 'Caja'}</h3>
      <p>Las decisiones son eventos persistentes; no reemplazan el valor pagado.</p>
      <div className={styles.field}>
        <label htmlFor="finance-reason">Razón / contexto</label>
        <textarea
          id="finance-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explica saldo, mora informada, soporte pendiente o motivo de liberación."
        />
      </div>
      {props.canUpdate ? (
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => void props.onValidate('APPROVED', reason)}
          >
            Aprobar gestión
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => void props.onValidate('REQUIRES_REVIEW', reason)}
          >
            Requiere revisión
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => void props.onValidate('REJECTED', reason)}
          >
            Rechazar
          </button>
        </div>
      ) : null}

      {props.canUpdate && !activeHold ? (
        <>
          <div className={styles.field}>
            <label htmlFor="finance-hold-code">Código de retención</label>
            <input
              id="finance-hold-code"
              value={holdCode}
              onChange={(event) => setHoldCode(event.target.value.toUpperCase())}
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
            />{' '}
            Exigir aprobación independiente para liberar
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!reason.trim() || !holdCode.trim()}
              onClick={() => void props.onHold(holdCode, reason, requiresApproval)}
            >
              Retener pedido
            </button>
          </div>
        </>
      ) : null}

      {props.canUpdate && activeHold ? (
        <div className={styles.warning}>
          <strong>Retención activa · {activeHold.reasonCode}</strong>
          <p>{activeHold.reason}</p>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => void props.onRelease(activeHold.id, reason)}
            >
              Liberar con trazabilidad
            </button>
            {activeHold.metadata.requiresApproval === true ? (
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => void props.onRequestException(activeHold.id, reason)}
              >
                Solicitar excepción
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

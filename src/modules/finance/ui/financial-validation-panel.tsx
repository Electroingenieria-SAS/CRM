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

function ValidationButtons(
  props: Pick<FinancialValidationPanelProps, 'onValidate'> & { reason: string },
) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        disabled={!props.reason.trim()}
        onClick={() => void props.onValidate('APPROVED', props.reason)}
      >
        Aprobar gestión
      </button>
      <button
        type="button"
        disabled={!props.reason.trim()}
        onClick={() => void props.onValidate('REQUIRES_REVIEW', props.reason)}
      >
        Requiere revisión
      </button>
      <button
        type="button"
        disabled={!props.reason.trim()}
        onClick={() => void props.onValidate('REJECTED', props.reason)}
      >
        Rechazar
      </button>
    </div>
  );
}

function NewHoldControls(
  props: Pick<FinancialValidationPanelProps, 'onHold'> & {
    reason: string;
    holdCode: string;
    requiresApproval: boolean;
    setHoldCode(value: string): void;
    setRequiresApproval(value: boolean): void;
  },
) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="finance-hold-code">Código de retención</label>
        <input
          id="finance-hold-code"
          value={props.holdCode}
          onChange={(event) => props.setHoldCode(event.target.value.toUpperCase())}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={props.requiresApproval}
          onChange={(event) => props.setRequiresApproval(event.target.checked)}
        />{' '}
        Exigir aprobación independiente para liberar
      </label>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!props.reason.trim() || !props.holdCode.trim()}
          onClick={() => void props.onHold(props.holdCode, props.reason, props.requiresApproval)}
        >
          Retener pedido
        </button>
      </div>
    </>
  );
}

function ActiveHoldControls(
  props: Pick<FinancialValidationPanelProps, 'onRelease' | 'onRequestException'> & {
    reason: string;
    hold: OrderFinancialSummary['activeHolds'][number];
  },
) {
  return (
    <div className={styles.warning}>
      <strong>Retención activa · {props.hold.reasonCode}</strong>
      <p>{props.hold.reason}</p>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!props.reason.trim()}
          onClick={() => void props.onRelease(props.hold.id, props.reason)}
        >
          Liberar con trazabilidad
        </button>
        {props.hold.metadata.requiresApproval === true ? (
          <button
            type="button"
            disabled={!props.reason.trim()}
            onClick={() => void props.onRequestException(props.hold.id, props.reason)}
          >
            Solicitar excepción
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FinancialValidationPanel(props: FinancialValidationPanelProps) {
  const [reason, setReason] = useState('');
  const [holdCode, setHoldCode] = useState(
    props.domain === 'CARTERA' ? 'OVERDUE_EXTERNAL' : 'PAYMENT_REVIEW',
  );
  const [requiresApproval, setRequiresApproval] = useState(false);
  const activeHold = props.summary.activeHolds[0];

  return (
    <section className={styles.panel} aria-labelledby="financial-decision-title">
      <h3 id="financial-decision-title">
        Decisión de {props.domain === 'CARTERA' ? 'Cartera' : 'Caja'}
      </h3>
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

      {props.canUpdate ? <ValidationButtons onValidate={props.onValidate} reason={reason} /> : null}

      {props.canUpdate && !activeHold ? (
        <NewHoldControls
          onHold={props.onHold}
          reason={reason}
          holdCode={holdCode}
          requiresApproval={requiresApproval}
          setHoldCode={setHoldCode}
          setRequiresApproval={setRequiresApproval}
        />
      ) : null}

      {props.canUpdate && activeHold ? (
        <ActiveHoldControls
          onRelease={props.onRelease}
          onRequestException={props.onRequestException}
          reason={reason}
          hold={activeHold}
        />
      ) : null}
    </section>
  );
}

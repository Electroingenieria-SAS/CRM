'use client';

import { useState } from 'react';
import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

interface CashSupportsPanelProps {
  summary: OrderFinancialSummary;
  canUpdate: boolean;
  onAdd(input: {
    supportType: string;
    storageProvider: string;
    storageReference: string;
  }): Promise<void>;
  onValidate(id: string, decision: 'VALIDATED' | 'REJECTED', reason: string): Promise<void>;
}

export function CashSupportsPanel(props: CashSupportsPanelProps) {
  const [supportRef, setSupportRef] = useState('');

  return (
    <section aria-labelledby="cash-supports-title">
      <h4 id="cash-supports-title">Soportes</h4>
      <p>Solo se guarda la referencia al archivo; el binario permanece en storage/Drive.</p>
      {props.canUpdate ? (
        <div className={styles.toolbar}>
          <input
            aria-label="Referencia del soporte"
            value={supportRef}
            onChange={(event) => setSupportRef(event.target.value)}
            placeholder="drive://... o referencia del proveedor"
          />
          <button
            type="button"
            disabled={!supportRef.trim()}
            onClick={() =>
              void props.onAdd({
                supportType: 'PAYMENT',
                storageProvider: 'EXTERNAL',
                storageReference: supportRef,
              })
            }
          >
            Registrar soporte
          </button>
        </div>
      ) : null}
      <div className={styles.list}>
        {props.summary.supports.map((support) => (
          <article className={styles.card} key={support.id}>
            <header>
              <strong>{support.supportType}</strong>
              <span className={styles.badge}>{support.validationStatus}</span>
            </header>
            <p>{support.storageProvider} · {support.storageReference}</p>
            {props.canUpdate && support.validationStatus === 'PENDING' ? (
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() =>
                    void props.onValidate(support.id, 'VALIDATED', 'Soporte verificado en Caja.')
                  }
                >
                  Validar soporte
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void props.onValidate(support.id, 'REJECTED', 'Soporte rechazado en Caja.')
                  }
                >
                  Rechazar soporte
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

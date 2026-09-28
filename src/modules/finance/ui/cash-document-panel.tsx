'use client';

import { useState } from 'react';
import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

interface CashDocumentPanelProps {
  summary: OrderFinancialSummary;
  canUpdate: boolean;
  canApprove: boolean;
  onAddSupport(input: {
    supportType: string;
    storageProvider: string;
    storageReference: string;
  }): Promise<void>;
  onValidateSupport(id: string, decision: 'VALIDATED' | 'REJECTED', reason: string): Promise<void>;
  onInvoice(input: {
    invoiceNumber: string;
    amount: number;
    currency: 'COP';
    supportId?: string;
  }): Promise<void>;
  onReverse(invoiceId: string, amount: number, reason: string): Promise<void>;
  onVoid(invoiceId: string, reason: string): Promise<void>;
}

export function CashDocumentPanel(props: CashDocumentPanelProps) {
  const [supportRef, setSupportRef] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [supportId, setSupportId] = useState('');
  const [reason, setReason] = useState('');

  return (
    <section className={styles.panel} aria-labelledby="cash-documents-title">
      <h3 id="cash-documents-title">Soportes y facturas</h3>
      <p>Los archivos permanecen en storage/Drive; Finanzas guarda únicamente referencias.</p>

      {props.canUpdate ? (
        <>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="cash-support-ref">Referencia del soporte</label>
              <input
                id="cash-support-ref"
                value={supportRef}
                onChange={(event) => setSupportRef(event.target.value)}
                placeholder="drive://... o referencia del proveedor"
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!supportRef.trim()}
              onClick={() =>
                void props.onAddSupport({
                  supportType: 'PAYMENT',
                  storageProvider: 'EXTERNAL',
                  storageReference: supportRef,
                })
              }
            >
              Registrar soporte
            </button>
          </div>
        </>
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
                <button type="button" onClick={() => void props.onValidateSupport(support.id, 'VALIDATED', 'Soporte verificado en Caja.')}>
                  Validar soporte
                </button>
                <button type="button" onClick={() => void props.onValidateSupport(support.id, 'REJECTED', 'Soporte rechazado en Caja.')}>
                  Rechazar soporte
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {props.canUpdate ? (
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="invoice-number">Factura</label>
            <input id="invoice-number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="invoice-amount">Valor pagado registrado (COP)</label>
            <input id="invoice-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="invoice-support">Soporte validado</label>
            <select id="invoice-support" value={supportId} onChange={(event) => setSupportId(event.target.value)}>
              <option value="">Sin asociar</option>
              {props.summary.supports.filter((item) => item.validationStatus === 'VALIDATED').map((item) => (
                <option value={item.id} key={item.id}>{item.supportType} · {item.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      {props.canUpdate ? (
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!invoiceNumber.trim() || !(Number(amount) > 0)}
            onClick={() => void props.onInvoice({
              invoiceNumber,
              amount: Number(amount),
              currency: 'COP',
              supportId: supportId || undefined,
            })}
          >
            Registrar factura pagada
          </button>
        </div>
      ) : null}

      <div className={styles.list}>
        {props.summary.invoices.map((invoice) => (
          <article className={styles.card} key={invoice.id}>
            <header>
              <strong>{invoice.invoiceNumber}</strong>
              <span className={styles.badge}>{invoice.status}</span>
            </header>
            <p>Pagado vigente: {invoice.paidAmount.toLocaleString('es-CO')} COP</p>
            {props.canApprove && invoice.status === 'REGISTERED' ? (
              <>
                <div className={styles.field}>
                  <label htmlFor={'reverse-' + invoice.id}>Motivo / valor de ajuste</label>
                  <input
                    id={'reverse-' + invoice.id}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Motivo obligatorio"
                  />
                </div>
                <div className={styles.actions}>
                  <button type="button" disabled={!reason.trim()} onClick={() => void props.onReverse(invoice.id, invoice.paidAmount, reason)}>
                    Reversar total
                  </button>
                  <button type="button" disabled={!reason.trim()} onClick={() => void props.onVoid(invoice.id, reason)}>
                    Anular
                  </button>
                </div>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

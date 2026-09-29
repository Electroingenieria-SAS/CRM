'use client';

import { useState } from 'react';
import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

interface CashInvoicesPanelProps {
  summary: OrderFinancialSummary;
  canUpdate: boolean;
  canApprove: boolean;
  onInvoice(input: {
    invoiceNumber: string;
    amount: number;
    currency: 'COP';
    supportId?: string;
  }): Promise<void>;
  onReverse(invoiceId: string, amount: number, reason: string): Promise<void>;
  onVoid(invoiceId: string, reason: string): Promise<void>;
}

function InvoiceRegistrationForm(props: Pick<CashInvoicesPanelProps, 'summary' | 'onInvoice'>) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [supportId, setSupportId] = useState('');

  return (
    <>
      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="invoice-number">Factura</label>
          <input
            id="invoice-number"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invoice-amount">Valor pagado registrado (COP)</label>
          <input
            id="invoice-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="invoice-support">Soporte validado</label>
          <select
            id="invoice-support"
            value={supportId}
            onChange={(event) => setSupportId(event.target.value)}
          >
            <option value="">Sin asociar</option>
            {props.summary.supports
              .filter((item) => item.validationStatus === 'VALIDATED')
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.supportType} · {item.id.slice(0, 8)}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!invoiceNumber.trim() || !(Number(amount) > 0)}
          onClick={() =>
            void props.onInvoice({
              invoiceNumber,
              amount: Number(amount),
              currency: 'COP',
              supportId: supportId || undefined,
            })
          }
        >
          Registrar factura pagada
        </button>
      </div>
    </>
  );
}

function InvoiceCard(props: {
  invoice: OrderFinancialSummary['invoices'][number];
  canApprove: boolean;
  onReverse(invoiceId: string, amount: number, reason: string): Promise<void>;
  onVoid(invoiceId: string, reason: string): Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const adjustable = props.canApprove && props.invoice.status === 'REGISTERED';

  return (
    <article className={styles.card}>
      <header>
        <strong>{props.invoice.invoiceNumber}</strong>
        <span className={styles.badge}>{props.invoice.status}</span>
      </header>
      <p>Pagado vigente: {props.invoice.paidAmount.toLocaleString('es-CO')} COP</p>
      {adjustable ? (
        <>
          <div className={styles.field}>
            <label htmlFor={'invoice-reason-' + props.invoice.id}>Motivo del ajuste</label>
            <input
              id={'invoice-reason-' + props.invoice.id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() =>
                void props.onReverse(props.invoice.id, props.invoice.paidAmount, reason)
              }
            >
              Reversar total
            </button>
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => void props.onVoid(props.invoice.id, reason)}
            >
              Anular
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function CashInvoicesPanel(props: CashInvoicesPanelProps) {
  return (
    <section aria-labelledby="cash-invoices-title">
      <h4 id="cash-invoices-title">Facturas registradas</h4>
      <p>Estas facturas son la fuente de verdad del valor efectivamente pagado.</p>
      {props.canUpdate ? (
        <InvoiceRegistrationForm summary={props.summary} onInvoice={props.onInvoice} />
      ) : null}
      <div className={styles.list}>
        {props.summary.invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            canApprove={props.canApprove}
            onReverse={props.onReverse}
            onVoid={props.onVoid}
          />
        ))}
      </div>
    </section>
  );
}

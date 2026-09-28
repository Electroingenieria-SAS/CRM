import type { OrderFinancialSummary } from '@/modules/finance/application/finance.schemas';
import { CashInvoicesPanel } from './cash-invoices-panel';
import { CashSupportsPanel } from './cash-supports-panel';
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
  return (
    <section className={styles.panel} aria-labelledby="cash-documents-title">
      <h3 id="cash-documents-title">Soportes y facturas</h3>
      <CashSupportsPanel
        summary={props.summary}
        canUpdate={props.canUpdate}
        onAdd={props.onAddSupport}
        onValidate={props.onValidateSupport}
      />
      <CashInvoicesPanel
        summary={props.summary}
        canUpdate={props.canUpdate}
        canApprove={props.canApprove}
        onInvoice={props.onInvoice}
        onReverse={props.onReverse}
        onVoid={props.onVoid}
      />
    </section>
  );
}

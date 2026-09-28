'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  FinanceQueue,
  FinanceQueueItem,
  OrderFinancialSummary,
} from '@/modules/finance/application/finance.schemas';
import type {
  FinanceDomain,
  InvoiceInput,
  QueueQuery,
  SupportInput,
} from '@/modules/finance/ports/finance-repository';
import { CashDocumentPanel } from '@/modules/finance/ui/cash-document-panel';
import { FinanceQueueTable } from '@/modules/finance/ui/finance-queue-table';
import { financeNavigation } from '@/modules/finance/ui/finance-navigation';
import { FinancialSummaryPanel } from '@/modules/finance/ui/financial-summary-panel';
import { FinancialValidationPanel } from '@/modules/finance/ui/financial-validation-panel';
import { AppShell } from '@/shared/ui/app-shell';
import styles from '@/modules/finance/ui/finance-ui.module.css';

interface FinanceActions {
  validate(result: 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW', reason: string): Promise<void>;
  hold(code: string, reason: string, approval: boolean): Promise<void>;
  release(holdId: string, reason: string): Promise<void>;
  requestReleaseException(holdId: string, reason: string): Promise<void>;
  addSupport(input: SupportInput): Promise<void>;
  validateSupport(id: string, decision: 'VALIDATED' | 'REJECTED', reason: string): Promise<void>;
  invoice(input: InvoiceInput): Promise<void>;
  reverse(id: string, amount: number, reason: string): Promise<void>;
  voidInvoice(id: string, reason: string): Promise<void>;
}

interface QueueWorkspaceProps {
  domain: FinanceDomain;
  context: SessionContext;
  queue: FinanceQueue;
  query: QueueQuery;
  selected: FinanceQueueItem | null;
  summary: OrderFinancialSummary | null;
  busy: boolean;
  message: string | null;
  notice: string | null;
  onQuery(query: QueueQuery): void;
  onSearch(query: QueueQuery): void;
  onSelect(item: FinanceQueueItem): void;
  actions: FinanceActions | null;
  onSignOut(): Promise<void>;
}

function FinanceQueueSection(props: Pick<
  QueueWorkspaceProps,
  'domain' | 'queue' | 'query' | 'selected' | 'onQuery' | 'onSearch' | 'onSelect'
>) {
  const title = props.domain === 'CARTERA' ? 'Cartera' : 'Caja';

  return (
    <section className={styles.section} aria-labelledby="finance-queue-title">
      <h2 id="finance-queue-title">Cola de {title}</h2>
      <div className={styles.toolbar}>
        <input
          aria-label={'Buscar en ' + title}
          value={props.query.search ?? ''}
          onChange={(event) => props.onQuery({ ...props.query, search: event.target.value })}
          placeholder="Pedido, cliente, documento o factura"
        />
        <select
          aria-label={'Estado de ' + title}
          value={props.query.status ?? ''}
          onChange={(event) =>
            props.onQuery({ ...props.query, status: event.target.value || undefined })
          }
        >
          <option value="">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="HELD">Retenidos</option>
        </select>
        <button type="button" onClick={() => props.onSearch(props.query)}>Buscar</button>
      </div>
      <FinanceQueueTable
        queue={props.queue}
        selectedId={props.selected?.orderId}
        onSelect={props.onSelect}
      />
    </section>
  );
}

function FinanceDetailSection(props: {
  domain: FinanceDomain;
  summary: OrderFinancialSummary;
  actions: FinanceActions;
  canUpdate: boolean;
  canApprove: boolean;
}) {
  return (
    <div className={styles.split}>
      <FinancialSummaryPanel summary={props.summary} />
      <div className={styles.list}>
        <FinancialValidationPanel
          domain={props.domain}
          summary={props.summary}
          canUpdate={props.canUpdate}
          onValidate={props.actions.validate}
          onHold={props.actions.hold}
          onRelease={props.actions.release}
          onRequestException={props.actions.requestReleaseException}
        />
        {props.domain === 'CAJA' ? (
          <CashDocumentPanel
            summary={props.summary}
            canUpdate={props.canUpdate}
            canApprove={props.canApprove}
            onAddSupport={props.actions.addSupport}
            onValidateSupport={props.actions.validateSupport}
            onInvoice={props.actions.invoice}
            onReverse={props.actions.reverse}
            onVoid={props.actions.voidInvoice}
          />
        ) : null}
      </div>
    </div>
  );
}

export function FinanceQueueWorkspace(props: QueueWorkspaceProps) {
  const moduleCode = props.domain === 'CARTERA' ? 'cartera' : 'caja';
  const canUpdate = hasModuleCapability(props.context, moduleCode, 'update');
  const canApprove =
    hasModuleCapability(props.context, moduleCode, 'approve') ||
    hasModuleCapability(props.context, 'approvals', 'approve');
  const title = props.domain === 'CARTERA' ? 'Cartera' : 'Caja';

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={financeNavigation(props.context, props.domain === 'CARTERA' ? 'cartera' : 'caja')}
      onSignOut={props.onSignOut}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Finanzas</p>
            <h1>{title}</h1>
            <p>
              {props.domain === 'CARTERA'
                ? 'Revisión, retenciones y liberaciones financieras explicables.'
                : 'Validación de soportes y facturas registradas como evidencia de pago.'}
            </p>
          </div>
        </header>

        {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}
        {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}

        <FinanceQueueSection {...props} />

        {props.summary && props.actions ? (
          <FinanceDetailSection
            domain={props.domain}
            summary={props.summary}
            actions={props.actions}
            canUpdate={canUpdate}
            canApprove={canApprove}
          />
        ) : null}

        {props.busy ? <p aria-live="polite">Actualizando información financiera…</p> : null}
      </div>
    </AppShell>
  );
}

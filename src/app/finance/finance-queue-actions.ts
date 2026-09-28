import type { BrowserApplication } from '@/composition/browser-application';
import type { FinanceQueueItem } from '@/modules/finance/application/finance.schemas';
import type {
  FinanceDomain,
  InvoiceInput,
  SupportInput,
} from '@/modules/finance/ports/finance-repository';

export interface FinanceQueueActionState {
  selected: FinanceQueueItem | null;
  refresh(): Promise<void>;
  select(orderId: string): Promise<void>;
  notice(message: string): void;
  error(message: string): void;
}

function key(prefix: string) {
  return prefix + ':' + crypto.randomUUID();
}

async function refreshSelected(state: FinanceQueueActionState) {
  await state.refresh();
  if (state.selected) await state.select(state.selected.orderId);
}

function decisionActions(
  application: BrowserApplication,
  domain: FinanceDomain,
  state: FinanceQueueActionState,
) {
  return {
    validate: async (
      result: 'APPROVED' | 'REJECTED' | 'REQUIRES_REVIEW',
      reason: string,
    ) => {
      if (!state.selected) return;
      await application.finance.validateOrder(
        { orderId: state.selected.orderId, type: domain, result, reason },
        key('finance-validation'),
      );
      state.notice('Decisión financiera registrada.');
      await refreshSelected(state);
    },
    hold: async (reasonCode: string, reason: string, requiresApproval: boolean) => {
      if (!state.selected) return;
      await application.finance.createHold(
        {
          orderId: state.selected.orderId,
          domain,
          reasonCode,
          reason,
          metadata: { requiresApproval },
        },
        key('finance-hold'),
      );
      state.notice('Pedido retenido con trazabilidad.');
      await refreshSelected(state);
    },
    release: async (holdId: string, reason: string) => {
      await application.finance.releaseHold(holdId, reason, key('finance-release'));
      state.notice('Retención liberada.');
      await refreshSelected(state);
    },
    requestReleaseException: async (holdId: string, reason: string) => {
      if (!state.selected) return;
      await application.finance.requestException(
        {
          orderId: state.selected.orderId,
          holdId,
          requestType: 'RELEASE_EXCEPTION',
          reason,
        },
        key('finance-exception'),
      );
      state.notice('Excepción enviada a aprobación independiente.');
      await state.select(state.selected.orderId);
    },
  };
}

function supportActions(application: BrowserApplication, state: FinanceQueueActionState) {
  return {
    addSupport: async (input: SupportInput) => {
      if (!state.selected) return;
      await application.finance.registerSupport(
        state.selected.orderId,
        undefined,
        input,
        key('finance-support'),
      );
      state.notice('Soporte financiero referenciado.');
      await state.select(state.selected.orderId);
    },
    validateSupport: async (
      supportId: string,
      decision: 'VALIDATED' | 'REJECTED',
      reason: string,
    ) => {
      await application.finance.validateSupport(
        supportId,
        decision,
        reason,
        key('finance-support-decision'),
      );
      state.notice('Estado del soporte actualizado.');
      if (state.selected) await state.select(state.selected.orderId);
    },
  };
}

function invoiceActions(application: BrowserApplication, state: FinanceQueueActionState) {
  return {
    invoice: async (input: InvoiceInput) => {
      if (!state.selected) return;
      await application.finance.registerInvoice(
        state.selected.orderId,
        input,
        key('finance-invoice'),
      );
      state.notice('Factura registrada como evidencia del valor pagado.');
      await refreshSelected(state);
    },
    reverse: async (invoiceId: string, amount: number, reason: string) => {
      await application.finance.reverseInvoice(invoiceId, amount, reason, key('finance-reverse'));
      state.notice('Reverso registrado sin borrar la factura original.');
      if (state.selected) await state.select(state.selected.orderId);
    },
    voidInvoice: async (invoiceId: string, reason: string) => {
      await application.finance.voidInvoice(invoiceId, reason, key('finance-void'));
      state.notice('Factura anulada con trazabilidad.');
      if (state.selected) await state.select(state.selected.orderId);
    },
  };
}

export function createFinanceQueueActions(
  application: BrowserApplication,
  domain: FinanceDomain,
  state: FinanceQueueActionState,
) {
  return {
    ...decisionActions(application, domain, state),
    ...supportActions(application, state),
    ...invoiceActions(application, state),
  };
}

import type { BillingBrowserApplication } from '@/composition/billing-browser-application';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { BillingQueueItem } from '@/modules/billing/application/billing.schemas';
import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';

interface BillingPageActionDependencies {
  application: BillingBrowserApplication | null;
  context: SessionContext | null;
  search: string;
  load(term?: string): Promise<void>;
  setBusy(value: boolean): void;
  setMessage(value: string | null): void;
  setNotice(value: string | null): void;
  goToLogin(): void;
}

async function runBillingAction(
  deps: BillingPageActionDependencies,
  operation: () => Promise<unknown>,
  success: string,
) {
  deps.setBusy(true);
  deps.setMessage(null);
  deps.setNotice(null);
  try {
    await operation();
    deps.setNotice(success);
    await deps.load(deps.search);
  } catch (error) {
    deps.setMessage(error instanceof Error ? error.message : 'No fue posible completar la operación.');
  } finally {
    deps.setBusy(false);
  }
}

export function createBillingPageActions(deps: BillingPageActionDependencies) {
  return {
    searchNow: () => deps.load(deps.search),
    registerInvoice: (item: BillingQueueItem, input: InvoiceInput) =>
      runBillingAction(
        deps,
        () => deps.application!.billing.registerInvoice(item.orderId, input, crypto.randomUUID()),
        'Factura registrada correctamente.',
      ),
    uploadPvpAnnex: (item: BillingQueueItem, file: File) =>
      runBillingAction(
        deps,
        () => {
          if (!deps.context) throw new Error('La sesión no está disponible.');
          return deps.application!.billing.uploadPvpAnnex(
            deps.context.organization.id,
            item.orderId,
            file,
            crypto.randomUUID(),
          );
        },
        'Anexo PVP registrado correctamente.',
      ),
    complete: (item: BillingQueueItem) =>
      runBillingAction(
        deps,
        () =>
          deps.application!.billing.complete(
            item.orderId,
            item.orderVersion,
            crypto.randomUUID(),
          ),
        'Pedido liberado hacia logística.',
      ),
    signOut: async () => {
      await deps.application?.auth.signOut();
      deps.goToLogin();
    },
  };
}

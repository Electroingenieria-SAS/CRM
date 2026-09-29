import type { FinanceService } from '@/modules/finance/application/finance-service';
import type { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';
import type {
  BillingEvidencePort,
  BillingFinancePort,
  BillingOrdersPort,
} from '@/modules/billing/ports/billing-ports';
import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';

export class FinanceBillingAdapter implements BillingFinancePort {
  constructor(private readonly finance: FinanceService) {}

  registerInvoice(orderId: string, input: InvoiceInput, key: string) {
    return this.finance.registerInvoice(orderId, input, key);
  }
}

export class OrdersBillingAdapter implements BillingOrdersPort, BillingEvidencePort {
  constructor(private readonly workflow: OrderWorkflowService) {}

  async completeBilling(
    orderId: string,
    version: number,
    resultCode: string,
    detail: string,
    key: string,
  ) {
    await this.workflow.complete(orderId, resultCode, detail, version, key);
  }

  async addPvpAnnex(
    orderId: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    key: string,
  ) {
    const result = await this.workflow.addEvidence(
      orderId,
      {
        evidenceType: 'PVP_ANNEX',
        storageProvider,
        storageReference,
        fileName,
        metadata: { source: 'BILLING' },
      },
      key,
    );
    return result.evidenceId;
  }
}

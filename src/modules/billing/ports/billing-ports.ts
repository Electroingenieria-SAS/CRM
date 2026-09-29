import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';
import type { BillingQueue, BillingReadiness } from '@/modules/billing/application/billing.schemas';

export interface BillingRepository {
  list(search?: string, page?: number, pageSize?: number): Promise<BillingQueue>;
  readiness(orderId: string): Promise<BillingReadiness>;
}

export interface BillingFinancePort {
  registerInvoice(orderId: string, input: InvoiceInput, key: string): Promise<string>;
}

export interface BillingEvidencePort {
  addPvpAnnex(
    orderId: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    key: string,
  ): Promise<string | undefined>;
}

export interface BillingOrdersPort {
  completeBilling(
    orderId: string,
    version: number,
    resultCode: string,
    detail: string,
    key: string,
  ): Promise<void>;
}

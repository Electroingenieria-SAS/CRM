import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';
import type { OrderEvidenceStoragePort } from '@/shared/evidence/order-evidence-storage';
import type {
  BillingEvidencePort,
  BillingFinancePort,
  BillingOrdersPort,
  BillingRepository,
} from '@/modules/billing/ports/billing-ports';

function requiredKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly finance: BillingFinancePort,
    private readonly evidence: BillingEvidencePort,
    private readonly orders: BillingOrdersPort,
    private readonly storage: OrderEvidenceStoragePort,
  ) {}

  list(search?: string, page = 1, pageSize = 25) {
    return this.repository.list(search?.trim() || undefined, page, pageSize);
  }

  readiness(orderId: string) {
    return this.repository.readiness(orderId);
  }

  registerInvoice(orderId: string, input: InvoiceInput, key: string) {
    return this.finance.registerInvoice(orderId, input, requiredKey(key));
  }

  async uploadPvpAnnex(organizationId: string, orderId: string, file: File, key: string) {
    const stored = await this.storage.upload({
      organizationId,
      orderId,
      evidenceType: 'PVP_ANNEX',
      file,
    });
    return this.addPvpAnnex(
      orderId,
      stored.storageProvider,
      stored.storageReference,
      stored.fileName,
      key,
    );
  }

  addPvpAnnex(
    orderId: string,
    storageProvider: string,
    storageReference: string,
    fileName: string | undefined,
    key: string,
  ) {
    if (!storageReference.trim()) throw new Error('La referencia del anexo es obligatoria.');
    return this.evidence.addPvpAnnex(
      orderId,
      storageProvider.trim() || 'EXTERNAL',
      storageReference.trim(),
      fileName?.trim() || undefined,
      requiredKey(key),
    );
  }

  async complete(orderId: string, version: number, key: string) {
    const readiness = await this.repository.readiness(orderId);
    if (!readiness.billingReady) {
      throw new Error(
        readiness.billingRequirement === 'PVP_ANNEX'
          ? 'Debes registrar el Anexo PVP antes de liberar el pedido.'
          : 'Debes registrar una factura válida antes de liberar el pedido.',
      );
    }
    if (readiness.financialDecision !== 'APPROVED' || readiness.blockingIssueOpen) {
      throw new Error('El pedido todavía tiene una restricción financiera u operativa.');
    }

    await this.orders.completeBilling(
      orderId,
      version,
      'BILLING_READY',
      'Facturación validada para envío a logística.',
      requiredKey(key),
    );
  }
}

import { describe, expect, it, vi } from 'vitest';
import { BillingService } from '@/modules/billing/application/billing-service';
import type {
  BillingEvidencePort,
  BillingFinancePort,
  BillingOrdersPort,
  BillingRepository,
} from '@/modules/billing/ports/billing-ports';
import type { OrderEvidenceStoragePort } from '@/shared/evidence/order-evidence-storage';

const orderId = '11111111-1111-4111-8111-111111111111';

function fixture(ready = true) {
  const repository: BillingRepository = {
    list: vi.fn(),
    readiness: vi.fn().mockResolvedValue({
      orderId,
      orderNumber: 'PED-1',
      orderType: 'PVC',
      routeCode: 'LOCAL_DISPATCH',
      currentStep: 'FACTURACION',
      billingReady: ready,
      billingRequirement: 'REGISTERED_INVOICE',
      financialDecision: 'APPROVED',
      financialReason: 'Sin retenciones.',
      blockingIssueOpen: false,
      readyForLogistics: ready,
      contractVersion: '1.0.0',
    }),
  };
  const finance: BillingFinancePort = {
    registerInvoice: vi.fn().mockResolvedValue('22222222-2222-4222-8222-222222222222'),
  };
  const evidence: BillingEvidencePort = {
    addPvpAnnex: vi.fn().mockResolvedValue('33333333-3333-4333-8333-333333333333'),
  };
  const orders: BillingOrdersPort = {
    completeBilling: vi.fn().mockResolvedValue(undefined),
  };
  const storage: OrderEvidenceStoragePort = {
    upload: vi.fn().mockResolvedValue({
      storageProvider: 'SUPABASE_STORAGE',
      storageReference: 'org/order/pvp/file.pdf',
      fileName: 'anexo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    }),
  };

  return {
    repository,
    finance,
    evidence,
    orders,
    storage,
    service: new BillingService(repository, finance, evidence, orders, storage),
  };
}

describe('billing service', () => {
  it('delegates invoice truth to Finance instead of duplicating it', async () => {
    const test = fixture();

    await test.service.registerInvoice(
      orderId,
      { invoiceNumber: 'FAC-001', amount: 150000, currency: 'COP' },
      'invoice-1',
    );

    expect(test.finance.registerInvoice).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ invoiceNumber: 'FAC-001', amount: 150000 }),
      'invoice-1',
    );
  });

  it('uploads a PVP annex through storage and records only its reference in Orders', async () => {
    const test = fixture();
    const file = new File(['%PDF-1.7'], 'anexo.pdf', { type: 'application/pdf' });

    await test.service.uploadPvpAnnex(
      '44444444-4444-4444-8444-444444444444',
      orderId,
      file,
      'pvp-1',
    );

    expect(test.storage.upload).toHaveBeenCalled();
    expect(test.evidence.addPvpAnnex).toHaveBeenCalledWith(
      orderId,
      'SUPABASE_STORAGE',
      'org/order/pvp/file.pdf',
      'anexo.pdf',
      'pvp-1',
    );
  });

  it('blocks release when the required billing document is missing', async () => {
    const test = fixture(false);

    await expect(test.service.complete(orderId, 3, 'complete-1')).rejects.toThrow(
      'Debes registrar una factura válida',
    );
    expect(test.orders.completeBilling).not.toHaveBeenCalled();
  });

  it('blocks release when Finance or an operational issue is not ready', async () => {
    const test = fixture();
    vi.mocked(test.repository.readiness).mockResolvedValue({
      ...(await test.repository.readiness(orderId)),
      financialDecision: 'ON_HOLD',
      readyForLogistics: false,
    });

    await expect(test.service.complete(orderId, 3, 'complete-2')).rejects.toThrow(
      'restricción financiera u operativa',
    );
    expect(test.orders.completeBilling).not.toHaveBeenCalled();
  });

  it('completes the Orders billing step using optimistic version and idempotency', async () => {
    const test = fixture();

    await test.service.complete(orderId, 7, 'complete-3');

    expect(test.orders.completeBilling).toHaveBeenCalledWith(
      orderId,
      7,
      'BILLING_READY',
      expect.stringContaining('Facturación validada'),
      'complete-3',
    );
  });
});

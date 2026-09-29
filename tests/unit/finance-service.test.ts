import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from '@/modules/finance/application/finance-service';
import type { FinanceRepository } from '@/modules/finance/ports/finance-repository';

function repository(): FinanceRepository {
  return {
    searchCustomers: vi.fn().mockResolvedValue({ items: [], contractVersion: '1.0.0' }),
    listCredit: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      contractVersion: '1.0.0',
    }),
    createCredit: vi.fn().mockResolvedValue(undefined),
    takeCredit: vi.fn().mockResolvedValue(undefined),
    decideCredit: vi.fn().mockResolvedValue(undefined),
    listQueue: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      contractVersion: '1.0.0',
    }),
    validateOrder: vi.fn().mockResolvedValue(undefined),
    createHold: vi.fn().mockResolvedValue('11111111-1111-4111-8111-111111111111'),
    releaseHold: vi.fn().mockResolvedValue(undefined),
    listApprovals: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      contractVersion: '1.0.0',
    }),
    requestException: vi.fn().mockResolvedValue('22222222-2222-4222-8222-222222222222'),
    decideException: vi.fn().mockResolvedValue(undefined),
    registerSupport: vi.fn().mockResolvedValue('33333333-3333-4333-8333-333333333333'),
    validateSupport: vi.fn().mockResolvedValue(undefined),
    registerInvoice: vi.fn().mockResolvedValue('44444444-4444-4444-8444-444444444444'),
    reverseInvoice: vi.fn().mockResolvedValue(undefined),
    voidInvoice: vi.fn().mockResolvedValue(undefined),
    orderSummary: vi.fn(),
    gate: vi.fn(),
    customerPaid: vi.fn(),
  };
}

describe('finance service', () => {
  it('rejects invalid credit money before hitting the repository', () => {
    const repo = repository();
    const service = new FinanceService(repo);

    expect(() =>
      service.createCredit(
        {
          customerId: '11111111-1111-4111-8111-111111111111',
          requestedAmount: -1,
          requestedTermDays: 30,
        },
        'credit-1',
      ),
    ).toThrow();

    expect(repo.createCredit).not.toHaveBeenCalled();
  });

  it('requires an idempotency key for critical mutations', () => {
    const repo = repository();
    const service = new FinanceService(repo);

    expect(() =>
      service.createCredit(
        {
          customerId: '11111111-1111-4111-8111-111111111111',
          requestedAmount: 100000,
          requestedTermDays: 30,
        },
        '   ',
      ),
    ).toThrow('La clave de idempotencia es obligatoria.');
  });

  it('does not allow a zero-value invoice registration', () => {
    const repo = repository();
    const service = new FinanceService(repo);

    expect(() =>
      service.registerInvoice(
        '55555555-5555-4555-8555-555555555555',
        { invoiceNumber: 'FAC-1', amount: 0, currency: 'COP' },
        'invoice-1',
      ),
    ).toThrow('El valor registrado debe ser mayor que cero.');
  });

  it('requires explicit reasons for releases and reversals', () => {
    const service = new FinanceService(repository());

    expect(() =>
      service.releaseHold('66666666-6666-4666-8666-666666666666', ' ', 'release-1'),
    ).toThrow('La liberación requiere una razón.');

    expect(() =>
      service.reverseInvoice('77777777-7777-4777-8777-777777777777', 100, '', 'reverse-1'),
    ).toThrow('El reverso requiere una razón.');
  });

  it('delegates Customer Intelligence paid projection without financial validation amounts', async () => {
    const repo = repository();
    vi.mocked(repo.customerPaid).mockResolvedValue({
      customerId: '88888888-8888-4888-8888-888888888888',
      totalPaid: 70000,
      invoiceCount: 2,
      source: 'REGISTERED_INVOICES_NET_OF_REVERSALS',
      contractVersion: '1.0.0',
    });
    const service = new FinanceService(repo);

    const result = await service.customerPaid('88888888-8888-4888-8888-888888888888');

    expect(result.source).toBe('REGISTERED_INVOICES_NET_OF_REVERSALS');
    expect(result.totalPaid).toBe(70000);
  });
});

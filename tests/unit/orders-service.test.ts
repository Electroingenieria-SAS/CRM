import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from '@/modules/orders/application/orders-service';
import type { OrdersRepository } from '@/modules/orders/application/orders-repository';

describe('orders service', () => {
  it('validates an order before delegating creation', async () => {
    const repository: OrdersRepository = {
      list: vi.fn(),
      create: vi.fn().mockResolvedValue({
        success: true,
        idempotent: false,
        orderId: '00000000-0000-0000-0000-000000000001',
        currentStep: 'RECEPCION_PEDIDO',
        status: 'QUEUED',
        contractVersion: '1.0.0',
      }),
    };

    const service = new OrdersService(repository);

    await service.create(
      {
        orderNumber: 'P-001',
        orderType: 'pvc',
        paymentCondition: 'cash',
        deliveryRoute: 'local_dispatch',
        clientName: 'Cliente',
        clientCity: 'Cali',
        clientAddress: 'Calle 1 # 2-3',
        items: [{ description: 'Cable', quantity: 2 }],
      },
      'request-001',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: 'PVC',
        paymentCondition: 'CASH',
        deliveryRoute: 'LOCAL_DISPATCH',
      }),
      'request-001',
    );
  });

  it('rejects cut items without a cut length', () => {
    const repository = { list: vi.fn(), create: vi.fn() } as unknown as OrdersRepository;
    const service = new OrdersService(repository);

    expect(() =>
      service.create(
        {
          orderNumber: 'P-002',
          orderType: 'PVC',
          paymentCondition: 'CASH',
          deliveryRoute: 'LOCAL_DISPATCH',
          clientName: 'Cliente',
          clientCity: 'Cali',
          clientAddress: 'Calle 1 # 2-3',
          items: [{ description: 'Cable', quantity: 1, requiresCut: true }],
        },
        'request-002',
      ),
    ).toThrow();
  });
});

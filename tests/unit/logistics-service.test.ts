import { describe, expect, it, vi } from 'vitest';
import { LogisticsService } from '@/modules/logistics/application/logistics-service';
import type {
  LogisticsEvidencePort,
  LogisticsFreightPort,
  LogisticsInventoryPort,
  LogisticsOrdersPort,
  LogisticsRepository,
} from '@/modules/logistics/ports/logistics-ports';
import type { OrderEvidenceStoragePort } from '@/shared/evidence/order-evidence-storage';

const shipmentId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const carrierId = '33333333-3333-4333-8333-333333333333';
const destinationId = '44444444-4444-4444-8444-444444444444';

function fixture() {
  const repository = {
    candidates: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
    release: vi.fn(),
    saveGuide: vi.fn(),
    dispatch: vi.fn().mockResolvedValue({
      success: true,
      idempotent: false,
      shipmentId,
      orderId,
      status: 'IN_TRANSIT',
      version: 2,
      actualFreight: 22000,
      carrierId,
      destinationId,
      predictionId: null,
      routeCode: 'NATIONAL_DISPATCH',
      dispatchedAt: '2026-09-29T15:00:00-05:00',
      contractVersion: '1.0.0',
    }),
    setActualCost: vi.fn(),
    markFreightSync: vi.fn().mockResolvedValue(undefined),
    failDelivery: vi.fn(),
    reprogram: vi.fn(),
    deliver: vi.fn().mockResolvedValue({
      success: true,
      idempotent: false,
      shipmentId,
      orderId,
      status: 'DELIVERED',
      version: 3,
      contractVersion: '1.0.0',
    }),
    returnShipment: vi.fn(),
    satisfaction: vi.fn(),
  } as unknown as LogisticsRepository;

  const freight: LogisticsFreightPort = {
    recordActual: vi.fn().mockResolvedValue({
      success: true,
      observationId: '55555555-5555-4555-8555-555555555555',
      predictionId: null,
      absoluteError: null,
      absolutePercentageError: null,
      signedError: null,
      contractVersion: '1.0.0',
    }),
  };
  const evidence: LogisticsEvidencePort = { add: vi.fn() };
  const orders: LogisticsOrdersPort = {
    ensureOperationalStarted: vi.fn().mockResolvedValue(undefined),
    completeDelivery: vi.fn().mockResolvedValue(undefined),
  };
  const storage: OrderEvidenceStoragePort = { upload: vi.fn() };
  const inventory: LogisticsInventoryPort = {
    onDispatched: vi.fn().mockResolvedValue(undefined),
    onReturned: vi.fn().mockResolvedValue(undefined),
  };

  return {
    repository,
    freight,
    evidence,
    orders,
    storage,
    inventory,
    service: new LogisticsService(
      repository,
      freight,
      evidence,
      orders,
      storage,
      inventory,
    ),
  };
}

describe('logistics service', () => {
  it('starts Orders/Workforce before dispatch and records actual freight separately', async () => {
    const test = fixture();

    await test.service.dispatch(shipmentId, orderId, 1, 22000, 'dispatch-1');

    expect(test.orders.ensureOperationalStarted).toHaveBeenCalledWith(
      orderId,
      'dispatch-1:orders',
    );
    expect(test.repository.dispatch).toHaveBeenCalledWith(
      shipmentId,
      1,
      22000,
      'dispatch-1',
    );
    expect(test.inventory.onDispatched).toHaveBeenCalledWith(
      orderId,
      'dispatch-1:inventory',
    );
    expect(test.freight.recordActual).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        carrierId,
        destinationId,
        actualCost: 22000,
        routeCode: 'NATIONAL_DISPATCH',
      }),
    );
    expect(test.repository.markFreightSync).toHaveBeenCalledWith(
      shipmentId,
      true,
      expect.objectContaining({
        observationId: '55555555-5555-4555-8555-555555555555',
      }),
    );
  });

  it('keeps dispatch committed and marks Freight sync failed when learning integration fails', async () => {
    const test = fixture();
    vi.mocked(test.freight.recordActual).mockRejectedValue(new Error('Freight offline'));

    await expect(
      test.service.dispatch(shipmentId, orderId, 1, 22000, 'dispatch-2'),
    ).resolves.toMatchObject({ status: 'IN_TRANSIT' });

    expect(test.repository.markFreightSync).toHaveBeenCalledWith(
      shipmentId,
      false,
      expect.objectContaining({ reason: 'Freight offline' }),
    );
  });

  it('confirms delivery and then advances Orders through its port', async () => {
    const test = fixture();

    await test.service.deliver(
      shipmentId,
      orderId,
      'Cliente QA',
      'Entrega conforme',
      '66666666-6666-4666-8666-666666666666',
      2,
      'deliver-1',
    );

    expect(test.orders.ensureOperationalStarted).toHaveBeenCalledWith(
      orderId,
      'deliver-1:orders',
    );
    expect(test.repository.deliver).toHaveBeenCalled();
    expect(test.orders.completeDelivery).toHaveBeenCalledWith(
      orderId,
      'deliver-1:orders-complete',
    );
  });

  it('requires evidence before confirming delivery', async () => {
    const test = fixture();

    await expect(
      test.service.deliver(shipmentId, orderId, undefined, undefined, '', 2, 'deliver-2'),
    ).rejects.toThrow('La evidencia de entrega es obligatoria.');

    expect(test.repository.deliver).not.toHaveBeenCalled();
  });

  it('rejects satisfaction values outside the 1 to 5 scale', () => {
    const test = fixture();

    expect(() => test.service.satisfaction(shipmentId, 6, undefined, 'sat-1')).toThrow(
      'La calificación debe estar entre 1 y 5.',
    );
    expect(test.repository.satisfaction).not.toHaveBeenCalled();
  });
});

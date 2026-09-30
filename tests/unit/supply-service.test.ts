import { describe, expect, it, vi } from 'vitest';
import { SupplyService } from '@/modules/supply/application/supply-service';
import type { SupplyRepository } from '@/modules/supply/ports/supply-repository';
import type {
  CuttingInventoryPort,
  PickingInventoryPort,
  ReceivingInventoryPort,
} from '@/modules/inventory/ports/inventory-integration-ports';

function repository(): SupplyRepository {
  return {
    queue: vi.fn(),
    createOrderReception: vi.fn(),
    confirmOrderReception: vi.fn(),
    createPurchaseRequest: vi.fn(),
    issuePurchaseOrder: vi.fn(),
    createReceipt: vi.fn(),
    confirmReceiptLine: vi.fn(),
    createPickingJob: vi.fn(),
    syncPickingLine: vi.fn(),
    createCuttingJob: vi.fn(),
    startCutting: vi.fn(),
    syncCuttingLine: vi.fn(),
    completeCutting: vi.fn(),
  };
}

function inventory() {
  return {
    receive: vi.fn().mockResolvedValue({
      movementId: '11111111-1111-4111-8111-111111111111',
      balance: {
        balanceId: '22222222-2222-4222-8222-222222222222',
        onHand: 5,
        reserved: 0,
        committed: 0,
        available: 5,
        version: 1,
      },
      contractVersion: '1.0.0',
    }),
    reserve: vi.fn().mockResolvedValue({
      reservationId: '33333333-3333-4333-8333-333333333333',
      reserved: 4,
      status: 'ACTIVE',
      contractVersion: '1.0.0',
    }),
    release: vi.fn(),
    pick: vi.fn().mockResolvedValue({
      reservationId: '33333333-3333-4333-8333-333333333333',
      quantity: 4,
      status: 'PICKED',
      contractVersion: '1.0.0',
    }),
    consume: vi.fn(),
    returnReusable: vi.fn(),
    waste: vi.fn(),
  };
}

function service(repo = repository()) {
  const inv = inventory();
  return {
    repo,
    inv,
    value: new SupplyService(
      repo,
      inv as ReceivingInventoryPort,
      inv as PickingInventoryPort,
      inv as CuttingInventoryPort,
    ),
  };
}

describe('SupplyService', () => {
  it('uses stable subkeys when posting a receipt to Inventory and Supply', async () => {
    const { repo, inv, value } = service();

    await value.receiveLine(
      {
        lineId: '44444444-4444-4444-8444-444444444444',
        materialId: '55555555-5555-4555-8555-555555555555',
        locationId: '66666666-6666-4666-8666-666666666666',
        quantity: 5,
        unit: 'UND',
      },
      'receipt-1',
    );

    expect(inv.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        metadata: expect.objectContaining({ source: 'SUPPLY_RECEIVING' }),
      }),
      'receipt-1:inventory',
    );
    expect(repo.confirmReceiptLine).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      'receipt-1:domain',
    );
  });

  it('reserves then picks before synchronizing Alistamiento', async () => {
    const { repo, inv, value } = service();

    await value.pickLine(
      {
        lineId: '44444444-4444-4444-8444-444444444444',
        orderId: '77777777-7777-4777-8777-777777777777',
        materialId: '55555555-5555-4555-8555-555555555555',
        quantity: 4,
        unit: 'UND',
      },
      'pick-1',
    );

    expect(inv.reserve).toHaveBeenCalledWith(expect.any(Object), 'pick-1:reserve');
    expect(inv.pick).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      4,
      'pick-1:pick',
    );
    expect(repo.syncPickingLine).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333',
      4,
      'pick-1:domain',
    );
  });

  it('requires evidence before closing Corte', () => {
    const { value } = service();
    expect(() =>
      value.completeCutting('88888888-8888-4888-8888-888888888888', '', 'cut-close'),
    ).toThrow('Corte requiere evidencia fotográfica.');
  });
});

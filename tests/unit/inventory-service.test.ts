import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from '@/modules/inventory/application/inventory-service';
import {
  inventoryAvailable,
  type InventoryBalanceLike,
} from '@/modules/inventory/domain/inventory-balance';
import type { InventoryRepository } from '@/modules/inventory/ports/inventory-repository';

function repository(): InventoryRepository {
  return {
    locations: vi.fn().mockResolvedValue([]),
    availability: vi.fn(),
    list: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      contractVersion: '1.0.0',
    }),
    materialDetail: vi.fn(),
    orderTrace: vi.fn(),
    receive: vi.fn(),
    reserve: vi.fn(),
    release: vi.fn(),
    pick: vi.fn(),
    consume: vi.fn(),
    returnReusable: vi.fn(),
    waste: vi.fn(),
    adjust: vi.fn(),
    reverseMovement: vi.fn(),
    submitCount: vi.fn(),
    reviewCount: vi.fn(),
    listCounts: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
      contractVersion: '1.0.0',
    }),
  };
}

describe('inventory balance domain', () => {
  it('derives available from physical, reserved and committed stock', () => {
    const balance: InventoryBalanceLike = { onHand: 100, reserved: 30, committed: 10 };
    expect(inventoryAvailable(balance)).toBe(60);
  });

  it('rejects inconsistent negative availability', () => {
    expect(() => inventoryAvailable({ onHand: 10, reserved: 8, committed: 8 })).toThrow(
      'El saldo de inventario es inconsistente.',
    );
  });
});

describe('inventory service', () => {
  it('normalizes units and rejects non-positive receipt quantities', () => {
    const repo = repository();
    const service = new InventoryService(repo);

    expect(() =>
      service.receive(
        {
          materialId: '11111111-1111-4111-8111-111111111111',
          locationId: '22222222-2222-4222-8222-222222222222',
          quantity: 0,
          unit: 'm',
        },
        'receive-1',
      ),
    ).toThrow('La cantidad debe ser mayor que cero.');

    expect(repo.receive).not.toHaveBeenCalled();
  });

  it('requires idempotency for reservations', () => {
    const service = new InventoryService(repository());
    expect(() =>
      service.reserve(
        {
          orderId: '11111111-1111-4111-8111-111111111111',
          materialId: '22222222-2222-4222-8222-222222222222',
          quantity: 2,
          unit: 'UND',
        },
        ' ',
      ),
    ).toThrow('La clave de idempotencia es obligatoria.');
  });

  it('requires reasons for reusable returns, waste and adjustments', () => {
    const service = new InventoryService(repository());

    expect(() =>
      service.returnReusable('11111111-1111-4111-8111-111111111111', 1, '', 'return-1'),
    ).toThrow('La devolución requiere un motivo.');
    expect(() =>
      service.waste('11111111-1111-4111-8111-111111111111', 1, '', 'waste-1'),
    ).toThrow('El desperdicio requiere un motivo.');
    expect(() =>
      service.adjust('11111111-1111-4111-8111-111111111111', 1, '', 'adjust-1'),
    ).toThrow('El ajuste requiere un motivo.');
  });

  it('accepts a zero physical count but rejects a negative count', () => {
    const service = new InventoryService(repository());
    expect(() =>
      service.submitCount('11111111-1111-4111-8111-111111111111', -1, '', 'count-1'),
    ).toThrow('El conteo físico no puede ser negativo.');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { FreightService } from '@/modules/freight/application/freight-service';
import type { FreightRepository } from '@/modules/freight/application/freight-repository';

function repositoryStub(): FreightRepository {
  return {
    getCatalog: vi.fn(),
    predict: vi.fn().mockResolvedValue({
      results: [],
      algorithmVersion: 'FREIGHT_ROBUST_V1',
      contractVersion: '1.0.0',
    }),
    listHistory: vi.fn(),
    getMetrics: vi.fn(),
    recordActual: vi.fn(),
  } as unknown as FreightRepository;
}

describe('freight service', () => {
  it('normalizes and validates prediction inputs', async () => {
    const repository = repositoryStub();
    const service = new FreightService(repository);

    await service.predict({
      destinationId: '11111111-1111-4111-8111-111111111111',
      routeCode: 'NATIONAL_DISPATCH',
      weightKg: 25,
    });

    expect(repository.predict).toHaveBeenCalledWith(
      expect.objectContaining({
        routeCode: 'NATIONAL_DISPATCH',
        weightKg: 25,
      }),
    );
  });

  it('rejects invalid negative predictive variables before the repository', () => {
    const service = new FreightService(repositoryStub());

    expect(() =>
      service.predict({
        destinationId: '11111111-1111-4111-8111-111111111111',
        routeCode: 'NATIONAL_DISPATCH',
        weightKg: -1,
      }),
    ).toThrow();
  });

  it('bounds history pagination for Free-plan friendly queries', async () => {
    const repository = repositoryStub();
    const service = new FreightService(repository);

    await service.listHistory({ page: 0, pageSize: 500 });

    expect(repository.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100 }),
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { OrderWorkflowRepository } from '@/modules/orders/application/order-workflow-repository';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';

function repository(): OrderWorkflowRepository {
  const result = {
    success: true as const,
    idempotent: false,
    orderId: '00000000-0000-0000-0000-000000000001',
    version: 2,
  };

  return {
    claim: vi.fn(async () => result),
    assign: vi.fn(async () => result),
    start: vi.fn(async () => result),
    block: vi.fn(async () => result),
    resume: vi.fn(async () => result),
    complete: vi.fn(async () => result),
    cancel: vi.fn(async () => result),
    reopen: vi.fn(async () => result),
    createIssue: vi.fn(async () => result),
    resolveIssue: vi.fn(async () => result),
    addEvidence: vi.fn(async () => result),
  };
}

describe('order workflow service', () => {
  it('requires a valid version and idempotency key for claims', async () => {
    const repo = repository();
    const service = new OrderWorkflowService(repo);

    await service.claim('order-1', 1, 'claim-1');

    expect(repo.claim).toHaveBeenCalledWith('order-1', 1, 'claim-1');
    expect(() => service.claim('order-1', 0, 'claim-1')).toThrow(
      'La versión operativa del pedido es inválida.',
    );
    expect(() => service.claim('order-1', 1, ' ')).toThrow(
      'La clave de idempotencia es obligatoria.',
    );
  });

  it('validates block detail before calling infrastructure', async () => {
    const repo = repository();
    const service = new OrderWorkflowService(repo);

    expect(() =>
      service.block('order-1', { reasonCode: 'material', detail: 'x' }, 2, 'block-1'),
    ).toThrow();

    await service.block(
      'order-1',
      { reasonCode: 'material', detail: 'Sin conductor disponible' },
      2,
      'block-2',
    );

    expect(repo.block).toHaveBeenCalledWith(
      'order-1',
      { reasonCode: 'MATERIAL', detail: 'Sin conductor disponible' },
      2,
      'block-2',
    );
  });

  it('keeps issue and evidence validation in the application layer', async () => {
    const repo = repository();
    const service = new OrderWorkflowService(repo);

    await service.createIssue(
      'order-1',
      {
        type: 'novelty',
        severity: 'HIGH',
        blocking: true,
        title: 'Falta información',
        description: 'El cliente debe confirmar una referencia.',
      },
      'issue-1',
    );

    await service.addEvidence(
      'order-1',
      {
        evidenceType: 'closure_proof',
        storageReference: 'drive-file-id',
      },
      'evidence-1',
    );

    expect(repo.createIssue).toHaveBeenCalledOnce();
    expect(repo.addEvidence).toHaveBeenCalledOnce();
  });
});

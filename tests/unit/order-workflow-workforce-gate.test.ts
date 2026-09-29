import { describe, expect, it, vi } from 'vitest';
import type { OrderWorkflowMutationObserver } from '@/modules/orders/application/order-workflow-observer';
import type { OrderWorkflowRepository } from '@/modules/orders/application/order-workflow-repository';
import { OrderWorkflowService } from '@/modules/orders/application/order-workflow-service';

function repository(): OrderWorkflowRepository {
  const result = {
    success: true as const,
    idempotent: false,
    orderId: '00000000-0000-0000-0000-000000000001',
    version: 3,
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

function observer(): OrderWorkflowMutationObserver {
  return {
    beforeComplete: vi.fn().mockResolvedValue(undefined),
    onWorkflowMutation: vi.fn().mockResolvedValue(undefined),
  };
}

describe('OrderWorkflowService Workforce completion gate', () => {
  it('checks Workforce before committing Orders completion', async () => {
    const repo = repository();
    const integration = observer();
    const service = new OrderWorkflowService(repo, integration);

    const result = await service.complete('order-1', 'COMPLETED', 'Etapa lista', 2, 'complete-1');

    expect(integration.beforeComplete).toHaveBeenCalledWith('order-1');
    expect(repo.complete).toHaveBeenCalledWith(
      'order-1',
      'COMPLETED',
      'Etapa lista',
      2,
      'complete-1',
    );
    expect(integration.onWorkflowMutation).toHaveBeenCalledWith(result);
  });

  it('does not complete Orders when Workforce evidence is not ready', async () => {
    const repo = repository();
    const integration = observer();
    vi.mocked(integration.beforeComplete!).mockRejectedValue(new Error('evidence required'));
    const service = new OrderWorkflowService(repo, integration);

    await expect(
      service.complete('order-1', 'COMPLETED', 'Etapa lista', 2, 'complete-2'),
    ).rejects.toThrow('evidence required');

    expect(repo.complete).not.toHaveBeenCalled();
    expect(integration.onWorkflowMutation).not.toHaveBeenCalled();
  });
});

import {
  blockTaskInputSchema,
  evidenceInputSchema,
  issueInputSchema,
} from '@/modules/orders/application/order-workflow.schemas';
import type { OrderWorkflowRepository } from '@/modules/orders/application/order-workflow-repository';

function requireKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

function requireVersion(version: number) {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('La versión operativa del pedido es inválida.');
  }
  return version;
}

export class OrderWorkflowService {
  constructor(private readonly repository: OrderWorkflowRepository) {}

  claim(orderId: string, version: number, key: string) {
    return this.repository.claim(orderId, requireVersion(version), requireKey(key));
  }

  assign(orderId: string, profileId: string, version: number, key: string) {
    if (!profileId.trim()) throw new Error('Selecciona un responsable.');
    return this.repository.assign(orderId, profileId.trim(), requireVersion(version), requireKey(key));
  }

  start(orderId: string, version: number, key: string) {
    return this.repository.start(orderId, requireVersion(version), requireKey(key));
  }

  block(orderId: string, input: unknown, version: number, key: string) {
    return this.repository.block(
      orderId,
      blockTaskInputSchema.parse(input),
      requireVersion(version),
      requireKey(key),
    );
  }

  resume(orderId: string, resolution: string, version: number, key: string) {
    const normalized = resolution.trim();
    if (normalized.length < 3) throw new Error('Describe cómo se resolvió el bloqueo.');
    return this.repository.resume(orderId, normalized, requireVersion(version), requireKey(key));
  }

  complete(orderId: string, resultCode: string, detail: string, version: number, key: string) {
    return this.repository.complete(
      orderId,
      resultCode.trim() || 'COMPLETED',
      detail.trim(),
      requireVersion(version),
      requireKey(key),
    );
  }

  cancel(orderId: string, reason: string, version: number, key: string) {
    const normalized = reason.trim();
    if (normalized.length < 3) throw new Error('Indica la razón de cancelación.');
    return this.repository.cancel(orderId, normalized, requireVersion(version), requireKey(key));
  }

  reopen(orderId: string, targetStep: string, reason: string, version: number, key: string) {
    const normalizedReason = reason.trim();
    if (!targetStep.trim()) throw new Error('Selecciona la etapa de reapertura.');
    if (normalizedReason.length < 3) throw new Error('Indica la razón de reapertura.');
    return this.repository.reopen(
      orderId,
      targetStep.trim().toUpperCase(),
      normalizedReason,
      requireVersion(version),
      requireKey(key),
    );
  }

  createIssue(orderId: string, input: unknown, key: string) {
    return this.repository.createIssue(orderId, issueInputSchema.parse(input), requireKey(key));
  }

  resolveIssue(issueId: string, resolution: string, key: string) {
    const normalized = resolution.trim();
    if (normalized.length < 3) throw new Error('Describe la resolución.');
    return this.repository.resolveIssue(issueId, normalized, requireKey(key));
  }

  addEvidence(orderId: string, input: unknown, key: string) {
    return this.repository.addEvidence(orderId, evidenceInputSchema.parse(input), requireKey(key));
  }
}

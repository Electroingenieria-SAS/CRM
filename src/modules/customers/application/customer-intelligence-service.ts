import { z } from 'zod';
import type {
  CustomerIntelligenceQuery,
  CustomerIntelligenceRepository,
} from '@/modules/customers/ports/customer-intelligence-repository';

const querySchema = z.object({
  search: z.string().trim().max(160).optional(),
  segment: z.enum(['PREMIUM', 'NORMAL', 'BASIC', 'URGENT']).or(z.literal('')).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

const customerIdSchema = z.string().uuid();

export class CustomerIntelligenceService {
  constructor(private readonly repository: CustomerIntelligenceRepository) {}

  list(query: CustomerIntelligenceQuery = {}) {
    return this.repository.list(querySchema.parse(query));
  }

  detail(customerId: string) {
    return this.repository.detail(customerIdSchema.parse(customerId));
  }

  pareto() {
    return this.repository.pareto();
  }

  recalculate() {
    return this.repository.recalculate();
  }

  prioritySignal(clientDocument?: string) {
    return this.repository.prioritySignal(clientDocument?.trim() || undefined);
  }
}

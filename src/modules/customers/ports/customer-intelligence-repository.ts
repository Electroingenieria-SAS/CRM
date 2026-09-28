import type {
  CustomerIntelligenceDetail,
  CustomerIntelligenceList,
  ParetoResponse,
  PrioritySignal,
  RecalculateResponse,
} from '@/modules/customers/application/customer-intelligence.schemas';

export interface CustomerIntelligenceQuery {
  search?: string;
  segment?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerIntelligenceRepository {
  list(query?: CustomerIntelligenceQuery): Promise<CustomerIntelligenceList>;
  detail(customerId: string): Promise<CustomerIntelligenceDetail>;
  pareto(): Promise<ParetoResponse>;
  recalculate(): Promise<RecalculateResponse>;
  prioritySignal(clientDocument?: string): Promise<PrioritySignal>;
}

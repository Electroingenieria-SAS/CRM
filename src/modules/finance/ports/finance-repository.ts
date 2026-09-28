import type {
  CreditQueue,
  CreditRequestInput,
  CustomerPaidProjection,
  FinanceQueue,
  FinancialGate,
  OrderFinancialSummary,
} from '@/modules/finance/application/finance.schemas';

export type FinanceDomain = 'CARTERA' | 'CAJA';

export interface QueueQuery {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface FinancialValidationInput {
  orderId: string;
  type: 'CREDIT' | 'CARTERA' | 'CAJA';
  result: 'APPROVED' | 'REJECTED' | 'ON_HOLD' | 'REQUIRES_REVIEW' | 'RELEASED';
  reason: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateHoldInput {
  orderId: string;
  domain: 'CREDIT' | 'CARTERA' | 'CAJA';
  reasonCode: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceInput {
  invoiceNumber: string;
  invoiceDate?: string;
  amount: number;
  currency?: 'COP';
  supportId?: string;
  metadata?: Record<string, unknown>;
}

export interface SupportInput {
  supportType: string;
  storageProvider: string;
  storageReference: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface FinanceRepository {
  listCredit(query?: QueueQuery): Promise<CreditQueue>;
  createCredit(input: CreditRequestInput, key: string): Promise<void>;
  takeCredit(requestId: string, key: string): Promise<void>;
  decideCredit(requestId: string, decision: 'APPROVED' | 'REJECTED', reason: string, key: string): Promise<void>;
  listQueue(domain: FinanceDomain, query?: QueueQuery): Promise<FinanceQueue>;
  validateOrder(input: FinancialValidationInput, key: string): Promise<void>;
  createHold(input: CreateHoldInput, key: string): Promise<string>;
  releaseHold(holdId: string, reason: string, key: string): Promise<void>;
  registerSupport(orderId: string, invoiceId: string | undefined, input: SupportInput, key: string): Promise<string>;
  validateSupport(supportId: string, decision: 'VALIDATED' | 'REJECTED', reason: string, key: string): Promise<void>;
  registerInvoice(orderId: string, input: InvoiceInput, key: string): Promise<string>;
  reverseInvoice(invoiceId: string, amount: number, reason: string, key: string): Promise<void>;
  voidInvoice(invoiceId: string, reason: string, key: string): Promise<void>;
  orderSummary(orderId: string): Promise<OrderFinancialSummary>;
  gate(orderId: string): Promise<FinancialGate>;
  customerPaid(customerId: string): Promise<CustomerPaidProjection>;
}

export interface CustomerPaidProjectionPort {
  customerPaid(customerId: string): Promise<CustomerPaidProjection>;
}

export interface FinancialGatePort {
  gate(orderId: string): Promise<FinancialGate>;
}

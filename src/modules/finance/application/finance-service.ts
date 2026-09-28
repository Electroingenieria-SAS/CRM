import { creditRequestInputSchema } from '@/modules/finance/application/finance.schemas';
import type {
  CreateHoldInput,
  FinanceDomain,
  FinanceRepository,
  FinancialExceptionInput,
  FinancialValidationInput,
  InvoiceInput,
  QueueQuery,
  SupportInput,
} from '@/modules/finance/ports/finance-repository';

function requiredKey(value: string) {
  const key = value.trim();
  if (!key) throw new Error('La clave de idempotencia es obligatoria.');
  return key;
}

export class FinanceService {
  constructor(private readonly repository: FinanceRepository) {}

  searchCustomers(search: string) {
    return this.repository.searchCustomers(search.trim());
  }

  listCredit(query: QueueQuery = {}) {
    return this.repository.listCredit(query);
  }

  createCredit(input: unknown, key: string) {
    return this.repository.createCredit(creditRequestInputSchema.parse(input), requiredKey(key));
  }

  takeCredit(requestId: string, key: string) {
    return this.repository.takeCredit(requestId, requiredKey(key));
  }

  decideCredit(requestId: string, decision: 'APPROVED' | 'REJECTED', reason: string, key: string) {
    const detail = reason.trim();
    if (!detail) throw new Error('La justificación es obligatoria.');
    return this.repository.decideCredit(requestId, decision, detail, requiredKey(key));
  }

  listQueue(domain: FinanceDomain, query: QueueQuery = {}) {
    return this.repository.listQueue(domain, query);
  }

  validateOrder(input: FinancialValidationInput, key: string) {
    if (!input.reason.trim()) throw new Error('La razón de la validación es obligatoria.');
    return this.repository.validateOrder(input, requiredKey(key));
  }

  createHold(input: CreateHoldInput, key: string) {
    if (!input.reason.trim() || !input.reasonCode.trim()) {
      throw new Error('La retención requiere código y razón.');
    }
    return this.repository.createHold(input, requiredKey(key));
  }

  releaseHold(holdId: string, reason: string, key: string) {
    if (!reason.trim()) throw new Error('La liberación requiere una razón.');
    return this.repository.releaseHold(holdId, reason.trim(), requiredKey(key));
  }

  listApprovals(query: QueueQuery = {}) {
    return this.repository.listApprovals(query);
  }

  requestException(input: FinancialExceptionInput, key: string) {
    if (!input.reason.trim()) throw new Error('La excepción requiere una justificación.');
    return this.repository.requestException(input, requiredKey(key));
  }

  decideException(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    key: string,
  ) {
    if (!reason.trim()) throw new Error('La decisión requiere una justificación.');
    return this.repository.decideException(approvalId, decision, reason.trim(), requiredKey(key));
  }

  registerSupport(orderId: string, invoiceId: string | undefined, input: SupportInput, key: string) {
    return this.repository.registerSupport(orderId, invoiceId, input, requiredKey(key));
  }

  validateSupport(supportId: string, decision: 'VALIDATED' | 'REJECTED', reason: string, key: string) {
    return this.repository.validateSupport(supportId, decision, reason.trim(), requiredKey(key));
  }

  registerInvoice(orderId: string, input: InvoiceInput, key: string) {
    if (!(input.amount > 0)) throw new Error('El valor registrado debe ser mayor que cero.');
    return this.repository.registerInvoice(orderId, input, requiredKey(key));
  }

  reverseInvoice(invoiceId: string, amount: number, reason: string, key: string) {
    if (!(amount > 0)) throw new Error('El reverso debe ser mayor que cero.');
    if (!reason.trim()) throw new Error('El reverso requiere una razón.');
    return this.repository.reverseInvoice(invoiceId, amount, reason.trim(), requiredKey(key));
  }

  voidInvoice(invoiceId: string, reason: string, key: string) {
    if (!reason.trim()) throw new Error('La anulación requiere una razón.');
    return this.repository.voidInvoice(invoiceId, reason.trim(), requiredKey(key));
  }

  orderSummary(orderId: string) {
    return this.repository.orderSummary(orderId);
  }

  gate(orderId: string) {
    return this.repository.gate(orderId);
  }

  customerPaid(customerId: string) {
    return this.repository.customerPaid(customerId);
  }
}

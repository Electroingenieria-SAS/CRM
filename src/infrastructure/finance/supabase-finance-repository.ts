import type { SupabaseClient } from '@supabase/supabase-js';
import {
  creditQueueSchema,
  customerPaidProjectionSchema,
  financeCustomerSearchSchema,
  financeQueueSchema,
  financialApprovalQueueSchema,
  financialGateSchema,
  orderFinancialSummarySchema,
  type CreditRequestInput,
} from '@/modules/finance/application/finance.schemas';
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
import { AppError } from '@/shared/errors/app-error';

function mapFinanceError(error: { code?: string; message?: string } | null) {
  if (error?.code === '42501') {
    return new AppError(
      'AUTHORIZATION',
      error.message ?? 'No tienes permisos para esta operación financiera.',
    );
  }
  if (error?.code === '22023' || error?.code === '23514') {
    return new AppError('VALIDATION', error.message ?? 'Los datos financieros no son válidos.');
  }
  if (error?.code === '23505') {
    return new AppError('BUSINESS_RULE', 'La operación financiera ya existe o fue procesada.');
  }
  if (error?.code === '40001') {
    return new AppError(
      'BUSINESS_RULE',
      'La información cambió mientras estaba abierta. Actualiza e inténtalo de nuevo.',
    );
  }
  return new AppError('DATABASE', 'No fue posible completar la operación financiera.');
}

function identifier(data: unknown, field: string) {
  if (!data || typeof data !== 'object')
    throw new AppError('DATABASE', 'Respuesta financiera inválida.');
  const value = (data as Record<string, unknown>)[field];
  if (typeof value !== 'string') throw new AppError('DATABASE', 'Respuesta financiera incompleta.');
  return value;
}

export class SupabaseFinanceRepository implements FinanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async searchCustomers(search: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_customer_search', {
      p_search: search,
      p_limit: 20,
    });
    if (error) throw mapFinanceError(error);
    return financeCustomerSearchSchema.parse(data);
  }

  async listCredit(query: QueueQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_finance_credit_queue', {
      p_status: query.status ?? null,
      p_search: query.search ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    if (error) throw mapFinanceError(error);
    return creditQueueSchema.parse(data);
  }

  async createCredit(input: CreditRequestInput, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_create_credit_request', {
      p_payload: input,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async takeCredit(requestId: string, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_take_credit_request', {
      p_request_id: requestId,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async decideCredit(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    key: string,
  ) {
    const { error } = await this.client.rpc('erp_x_finance_decide_credit_request', {
      p_request_id: requestId,
      p_decision: decision,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async listQueue(domain: FinanceDomain, query: QueueQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_finance_queue', {
      p_domain: domain,
      p_status: query.status ?? null,
      p_search: query.search ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    if (error) throw mapFinanceError(error);
    return financeQueueSchema.parse(data);
  }

  async validateOrder(input: FinancialValidationInput, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_validate_order', {
      p_order_id: input.orderId,
      p_validation_type: input.type,
      p_result: input.result,
      p_reason: input.reason,
      p_reference: input.reference ?? null,
      p_metadata: input.metadata ?? {},
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async createHold(input: CreateHoldInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_create_hold', {
      p_order_id: input.orderId,
      p_domain: input.domain,
      p_reason_code: input.reasonCode,
      p_reason: input.reason,
      p_metadata: input.metadata ?? {},
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
    return identifier(data, 'holdId');
  }

  async releaseHold(holdId: string, reason: string, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_release_hold', {
      p_hold_id: holdId,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async listApprovals(query: QueueQuery = {}) {
    const { data, error } = await this.client.rpc('erp_x_finance_approval_queue', {
      p_status: query.status ?? 'PENDING',
      p_search: query.search ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 25,
    });
    if (error) throw mapFinanceError(error);
    return financialApprovalQueueSchema.parse(data);
  }

  async requestException(input: FinancialExceptionInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_request_exception', {
      p_order_id: input.orderId,
      p_hold_id: input.holdId ?? null,
      p_request_type: input.requestType,
      p_reason: input.reason,
      p_metadata: input.metadata ?? {},
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
    return identifier(data, 'approvalId');
  }

  async decideException(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    key: string,
  ) {
    const { error } = await this.client.rpc('erp_x_finance_decide_exception', {
      p_approval_id: approvalId,
      p_decision: decision,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async registerSupport(
    orderId: string,
    invoiceId: string | undefined,
    input: SupportInput,
    key: string,
  ) {
    const { data, error } = await this.client.rpc('erp_x_finance_add_support', {
      p_order_id: orderId,
      p_invoice_id: invoiceId ?? null,
      p_payload: input,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
    return identifier(data, 'supportId');
  }

  async validateSupport(
    supportId: string,
    decision: 'VALIDATED' | 'REJECTED',
    reason: string,
    key: string,
  ) {
    const { error } = await this.client.rpc('erp_x_finance_validate_support', {
      p_support_id: supportId,
      p_decision: decision,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async registerInvoice(orderId: string, input: InvoiceInput, key: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_register_invoice', {
      p_order_id: orderId,
      p_payload: input,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
    return identifier(data, 'invoiceId');
  }

  async reverseInvoice(invoiceId: string, amount: number, reason: string, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_reverse_invoice', {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async voidInvoice(invoiceId: string, reason: string, key: string) {
    const { error } = await this.client.rpc('erp_x_finance_void_invoice', {
      p_invoice_id: invoiceId,
      p_reason: reason,
      p_idempotency_key: key,
    });
    if (error) throw mapFinanceError(error);
  }

  async orderSummary(orderId: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_order_summary', {
      p_order_id: orderId,
    });
    if (error) throw mapFinanceError(error);
    return orderFinancialSummarySchema.parse(data);
  }

  async gate(orderId: string) {
    const { data, error } = await this.client.rpc('erp_x_financial_gate', { p_order_id: orderId });
    if (error) throw mapFinanceError(error);
    return financialGateSchema.parse(data);
  }

  async customerPaid(customerId: string) {
    const { data, error } = await this.client.rpc('erp_x_finance_customer_paid', {
      p_customer_id: customerId,
    });
    if (error) throw mapFinanceError(error);
    return customerPaidProjectionSchema.parse(data);
  }
}

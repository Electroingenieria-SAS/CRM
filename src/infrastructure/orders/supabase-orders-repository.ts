import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createOrderResponseSchema,
  orderDetailResponseSchema,
  orderListResponseSchema,
  type CreateOrderInput,
  type CreateOrderResponse,
  type OrderDetailResponse,
  type OrderListResponse,
} from '@/modules/orders/application/order.schemas';
import type {
  ListOrdersQuery,
  OrdersRepository,
} from '@/modules/orders/application/orders-repository';
import { AppError } from '@/shared/errors/app-error';

function mapRepositoryError(error: { message?: string; code?: string } | null): AppError {
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', 'No tienes permisos para realizar esta operación.');
  }

  if (error?.code === '23505') {
    return new AppError('BUSINESS_RULE', 'Ya existe un pedido con ese número.');
  }

  if (error?.code === 'P0002') {
    return new AppError('BUSINESS_RULE', 'El pedido solicitado no existe o no es visible.');
  }

  return new AppError('DATABASE', 'No fue posible completar la operación de pedidos.');
}

export class SupabaseOrdersRepository implements OrdersRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(query: ListOrdersQuery = {}): Promise<OrderListResponse> {
    const { data, error } = await this.client.rpc('erp_x_list_orders', {
      p_search: query.search ?? null,
      p_step: query.step ?? null,
      p_status: query.status ?? null,
      p_order_type: query.orderType ?? null,
      p_route: query.route ?? null,
      p_page: query.page ?? 1,
      p_page_size: query.pageSize ?? 50,
      p_include_history: query.includeHistory ?? true,
    });

    if (error) throw mapRepositoryError(error);
    return orderListResponseSchema.parse(data);
  }

  async get(orderId: string): Promise<OrderDetailResponse> {
    const { data, error } = await this.client.rpc('erp_x_get_order', {
      p_order_id: orderId,
    });

    if (error) throw mapRepositoryError(error);
    return orderDetailResponseSchema.parse(data);
  }

  async create(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResponse> {
    const { data, error } = await this.client.rpc('erp_x_create_order', {
      p_payload: input,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw mapRepositoryError(error);
    return createOrderResponseSchema.parse(data);
  }
}

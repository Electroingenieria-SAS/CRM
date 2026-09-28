import type {
  CreateOrderInput,
  CreateOrderResponse,
  OrderListResponse,
} from '@/modules/orders/application/order.schemas';

export interface ListOrdersQuery {
  search?: string;
  step?: string;
  status?: string;
  orderType?: string;
  route?: string;
  page?: number;
  pageSize?: number;
  includeHistory?: boolean;
}

export interface OrdersRepository {
  list(query?: ListOrdersQuery): Promise<OrderListResponse>;
  create(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResponse>;
}

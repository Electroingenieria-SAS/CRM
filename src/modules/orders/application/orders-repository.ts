import type {
  CreateOrderInput,
  CreateOrderResponse,
  OrderDetailResponse,
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
  get(orderId: string): Promise<OrderDetailResponse>;
  create(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResponse>;
}

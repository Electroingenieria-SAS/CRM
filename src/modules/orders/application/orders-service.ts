import { createOrderSchema } from '@/modules/orders/application/order.schemas';
import type {
  ListOrdersQuery,
  OrdersRepository,
} from '@/modules/orders/application/orders-repository';

export class OrdersService {
  constructor(private readonly repository: OrdersRepository) {}

  list(query: ListOrdersQuery = {}) {
    return this.repository.list(query);
  }

  create(input: unknown, idempotencyKey: string) {
    const payload = createOrderSchema.parse(input);
    const key = idempotencyKey.trim();

    if (!key) {
      throw new Error('La clave de idempotencia es obligatoria para crear pedidos.');
    }

    return this.repository.create(payload, key);
  }
}

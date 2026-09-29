import type { SupabaseClient } from '@supabase/supabase-js';
import { ordersWorkforceIndicatorSnapshotSchema } from '@/modules/integrations/orders-workforce/application/orders-workforce-indicator.schemas';
import type { OrdersWorkforceIndicatorsPort } from '@/modules/integrations/orders-workforce/application/orders-workforce-indicators';
import { AppError } from '@/shared/errors/app-error';

export class SupabaseOrdersWorkforceIndicatorsRepository implements OrdersWorkforceIndicatorsPort {
  constructor(private readonly client: SupabaseClient) {}

  async snapshot(from?: string, to?: string) {
    const { data, error } = await this.client.rpc('erp_x_order_workforce_indicators', {
      p_from: from ?? null,
      p_to: to ?? null,
    });

    if (error?.code === '42501') {
      throw new AppError('AUTHORIZATION', 'No tienes permisos para consultar estos indicadores.');
    }
    if (error) {
      throw new AppError('DATABASE', 'No fue posible cargar los indicadores operativos.');
    }

    return ordersWorkforceIndicatorSnapshotSchema.parse(data);
  }
}

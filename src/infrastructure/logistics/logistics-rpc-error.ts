import { AppError } from '@/shared/errors/app-error';

export function mapLogisticsError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.trim();
  if (error?.code === '42501') {
    return new AppError('AUTHORIZATION', message ?? 'No tienes permisos para esta operación.');
  }
  if (error?.code === '40001') {
    return new AppError(
      'BUSINESS_RULE',
      message ?? 'El despacho cambió. Actualiza antes de continuar.',
    );
  }
  if (error?.code === '22023') {
    return new AppError('VALIDATION', message ?? 'Los datos logísticos no son válidos.');
  }
  if (error?.code === '23505' || error?.code === '23514') {
    return new AppError('BUSINESS_RULE', message ?? 'La operación logística no está permitida.');
  }
  return new AppError('DATABASE', message ?? 'No fue posible completar la operación logística.');
}

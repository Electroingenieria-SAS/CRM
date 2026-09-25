export const BUSINESS_TIME_ZONE = 'America/Bogota' as const;

export function formatBusinessDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date);
}

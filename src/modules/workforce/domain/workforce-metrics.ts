import type {
  WorkforceOccupancyStatus,
  WorkforceTimeSignal,
} from '@/modules/workforce/domain/workforce-types';

export function timeSignalFromBusinessSeconds(seconds: number): WorkforceTimeSignal {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('Duración laboral inválida.');
  }

  return seconds > 3600 ? 'OVER_60_MINUTES' : 'NORMAL';
}

export function occupancyLabel(status: WorkforceOccupancyStatus): string {
  const labels: Record<WorkforceOccupancyStatus, string> = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupado',
    BLOCKED: 'Bloqueado',
    OUT_OF_SCHEDULE: 'Fuera de jornada',
  };

  return labels[status];
}

export function shouldCountInMetrics(policy: {
  excludeFromOccupancyMetrics: boolean;
  excludeFromTimeMetrics: boolean;
}): boolean {
  return !policy.excludeFromOccupancyMetrics && !policy.excludeFromTimeMetrics;
}

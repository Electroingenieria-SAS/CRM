import { workforceDaySlots } from '@/modules/workforce/domain/work-schedule';
import type { WorkforceActivitySummary } from '@/modules/workforce/application/workforce.schemas';
import { businessClockMinutes, businessIsoDate } from '@/modules/workforce/ui/workforce-range';

export function activitiesForDay(
  activities: readonly WorkforceActivitySummary[],
  profileId: string,
  day: string,
) {
  return activities.filter(
    (activity) =>
      activity.assigneeProfileId === profileId &&
      businessIsoDate(activity.plannedStart) === day &&
      activity.status !== 'CANCELLED',
  );
}

export function activitiesForSlot(
  activities: readonly WorkforceActivitySummary[],
  slotIndex: number,
) {
  const slot = workforceDaySlots[slotIndex];
  if (!slot) return [];

  return activities.filter((activity) => {
    const start = businessClockMinutes(activity.plannedStart);
    const end = businessClockMinutes(activity.plannedEnd);
    return start < slot.endMinutes && slot.startMinutes < end;
  });
}

export function activityStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLANNED: 'Planificada',
    IN_PROGRESS: 'En curso',
    BLOCKED: 'Bloqueada',
    COMPLETED: 'Realizada',
    CANCELLED: 'Cancelada',
  };
  return labels[status] ?? status;
}

export function timeSignalLabel(signal: string): string | null {
  return signal === 'OVER_60_MINUTES' ? 'Más de 1 h' : null;
}

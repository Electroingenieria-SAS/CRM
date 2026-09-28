'use client';

import type { WorkforceActivitySummary } from '@/modules/workforce/application/workforce.schemas';
import { activityStatusLabel } from '@/modules/workforce/ui/workforce-calendar-utils';
import { businessIsoDate } from '@/modules/workforce/ui/workforce-range';
import styles from './workforce-period-views.module.css';

interface WorkforceMonthViewProps {
  from: string;
  to: string;
  activities: readonly WorkforceActivitySummary[];
  holidays: readonly { date: string; name: string }[];
  onOpen(activityId: string): void;
}

function businessDays(from: string, to: string): string[] {
  const rows: string[] = [];
  let cursor = new Date(`${from}T12:00:00-05:00`);
  const end = new Date(`${to}T12:00:00-05:00`);

  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      rows.push(cursor.toISOString().slice(0, 10));
    }
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return rows;
}

export function WorkforceMonthView({
  from,
  to,
  activities,
  holidays,
  onOpen,
}: WorkforceMonthViewProps) {
  const days = businessDays(from, to);
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

  return (
    <section className={styles.month} aria-label="Planificación mensual">
      <header className={styles.monthWeekdays} aria-hidden="true">
        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </header>
      <div className={styles.monthGrid}>
        {days.map((day, index) => {
          const holiday = holidayMap.get(day);
          const rows = activities.filter(
            (activity) =>
              businessIsoDate(activity.plannedStart) === day && activity.status !== 'CANCELLED',
          );
          const weekday = new Date(`${day}T12:00:00-05:00`).getUTCDay();
          return (
            <article
              className={styles.monthDay}
              data-holiday={Boolean(holiday)}
              style={index === 0 ? { gridColumnStart: weekday } : undefined}
              key={day}
            >
              <header>
                <strong>{Number(day.slice(-2))}</strong>
                <span>{holiday ?? `${rows.length} actividad${rows.length === 1 ? '' : 'es'}`}</span>
              </header>
              {!holiday ? (
                <div className={styles.monthItems}>
                  {rows.slice(0, 3).map((activity) => (
                    <button type="button" onClick={() => onOpen(activity.id)} key={activity.id}>
                      <strong>{activity.title}</strong>
                      <small>{activityStatusLabel(activity.status)}</small>
                    </button>
                  ))}
                  {rows.length > 3 ? <span>+{rows.length - 3} más</span> : null}
                </div>
              ) : (
                <p className={styles.nonWorking}>Sin jornada activa</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

'use client';

import type {
  WorkforceActivitySummary,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import {
  activityStatusLabel,
  timeSignalLabel,
} from '@/modules/workforce/ui/workforce-calendar-utils';
import { businessIsoDate, shiftIsoDate } from '@/modules/workforce/ui/workforce-range';
import styles from './workforce-period-views.module.css';

interface WorkforceWeekViewProps {
  from: string;
  people: readonly WorkforcePerson[];
  activities: readonly WorkforceActivitySummary[];
  holidays: readonly { date: string; name: string }[];
  onOpen(activityId: string): void;
}

function WeekActivity({
  activity,
  onOpen,
}: {
  activity: WorkforceActivitySummary;
  onOpen(activityId: string): void;
}) {
  return (
    <button
      type="button"
      className={styles.weekActivity}
      data-status={activity.status}
      onClick={() => onOpen(activity.id)}
    >
      <strong>{activity.title}</strong>
      <span>{activityStatusLabel(activity.status)}</span>
      {activity.orderNumber ? <small>Pedido {activity.orderNumber}</small> : null}
      {timeSignalLabel(activity.timeSignal) ? <small>Más de 1 h</small> : null}
    </button>
  );
}

export function WorkforceWeekView({
  from,
  people,
  activities,
  holidays,
  onOpen,
}: WorkforceWeekViewProps) {
  const days = Array.from({ length: 5 }, (_, index) => shiftIsoDate(from, index));
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

  return (
    <section className={styles.weekWrap} aria-label="Cronograma semanal">
      <div className={styles.weekGrid} role="table">
        <div className={styles.corner} role="columnheader">Equipo</div>
        {days.map((day) => (
          <div className={styles.dayHead} role="columnheader" key={day}>
            <strong>
              {new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'America/Bogota' })
                .format(new Date(`${day}T12:00:00-05:00`))}
            </strong>
            <span>{day.slice(5)}</span>
            {holidayMap.has(day) ? <small>{holidayMap.get(day)}</small> : null}
          </div>
        ))}

        {people.map((person) => (
          <div className={styles.weekRow} role="row" key={person.id}>
            <div className={styles.person} role="rowheader">
              <strong>{person.name}</strong>
              <span>{person.occupancy}</span>
            </div>
            {days.map((day) => {
              const rows = activities.filter(
                (activity) =>
                  activity.assigneeProfileId === person.id &&
                  businessIsoDate(activity.plannedStart) === day &&
                  activity.status !== 'CANCELLED',
              );
              const holiday = holidayMap.get(day);
              return (
                <div className={styles.weekCell} role="cell" key={day}>
                  {holiday ? (
                    <span className={styles.nonWorking}>Festivo</span>
                  ) : rows.length ? (
                    rows.map((activity) => (
                      <WeekActivity activity={activity} onOpen={onOpen} key={activity.id} />
                    ))
                  ) : (
                    <span className={styles.available}>Disponible</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

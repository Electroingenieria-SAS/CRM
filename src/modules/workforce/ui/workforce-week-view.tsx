'use client';

import type {
  WorkforceActivitySummary,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import { occupancyLabel } from '@/modules/workforce/domain/workforce-metrics';
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

function dayLabel(day: string) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(`${day}T12:00:00-05:00`));
}

function personDayActivities(
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

function WeekCellContent({
  rows,
  holiday,
  onOpen,
}: {
  rows: readonly WorkforceActivitySummary[];
  holiday?: string;
  onOpen(activityId: string): void;
}) {
  if (holiday) return <span className={styles.nonWorking}>Festivo · {holiday}</span>;
  if (!rows.length) return <span className={styles.available}>Disponible</span>;
  return rows.map((activity) => (
    <WeekActivity activity={activity} onOpen={onOpen} key={activity.id} />
  ));
}

function DesktopWeek({
  days,
  people,
  activities,
  holidayMap,
  onOpen,
}: {
  days: readonly string[];
  people: readonly WorkforcePerson[];
  activities: readonly WorkforceActivitySummary[];
  holidayMap: ReadonlyMap<string, string>;
  onOpen(activityId: string): void;
}) {
  return (
    <div className={styles.desktopWeek}>
      <div className={styles.weekGrid} role="table">
        <div className={styles.corner} role="columnheader">
          Equipo
        </div>
        {days.map((day) => (
          <div className={styles.dayHead} role="columnheader" key={day}>
            <strong>{dayLabel(day)}</strong>
            {holidayMap.has(day) ? <small>{holidayMap.get(day)}</small> : null}
          </div>
        ))}
        {people.map((person) => (
          <div className={styles.weekRow} role="row" key={person.id}>
            <div className={styles.person} role="rowheader">
              <strong>{person.name}</strong>
              <span>{occupancyLabel(person.occupancy)}</span>
            </div>
            {days.map((day) => (
              <div className={styles.weekCell} role="cell" key={day}>
                <WeekCellContent
                  rows={personDayActivities(activities, person.id, day)}
                  holiday={holidayMap.get(day)}
                  onOpen={onOpen}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileWeek({
  days,
  people,
  activities,
  holidayMap,
  onOpen,
}: {
  days: readonly string[];
  people: readonly WorkforcePerson[];
  activities: readonly WorkforceActivitySummary[];
  holidayMap: ReadonlyMap<string, string>;
  onOpen(activityId: string): void;
}) {
  return (
    <div className={styles.mobileWeek}>
      {people.map((person) => (
        <article className={styles.mobileWeekPerson} key={person.id}>
          <header>
            <strong>{person.name}</strong>
            <span>{occupancyLabel(person.occupancy)}</span>
          </header>
          {days.map((day) => (
            <section className={styles.mobileWeekDay} key={day}>
              <h3>{dayLabel(day)}</h3>
              <WeekCellContent
                rows={personDayActivities(activities, person.id, day)}
                holiday={holidayMap.get(day)}
                onOpen={onOpen}
              />
            </section>
          ))}
        </article>
      ))}
    </div>
  );
}

export function WorkforceWeekView(props: WorkforceWeekViewProps) {
  const days = Array.from({ length: 5 }, (_, index) => shiftIsoDate(props.from, index));
  const holidayMap = new Map(props.holidays.map((holiday) => [holiday.date, holiday.name]));

  return (
    <section className={styles.weekSection} aria-label="Cronograma semanal">
      <DesktopWeek
        days={days}
        people={props.people}
        activities={props.activities}
        holidayMap={holidayMap}
        onOpen={props.onOpen}
      />
      <MobileWeek
        days={days}
        people={props.people}
        activities={props.activities}
        holidayMap={holidayMap}
        onOpen={props.onOpen}
      />
    </section>
  );
}

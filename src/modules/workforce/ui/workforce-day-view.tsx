'use client';

import { workforceDaySlots } from '@/modules/workforce/domain/work-schedule';
import { occupancyLabel } from '@/modules/workforce/domain/workforce-metrics';
import { occupancyLabel } from '@/modules/workforce/domain/workforce-metrics';
import type {
  WorkforceActivitySummary,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import {
  activitiesForDay,
  activitiesForSlot,
  activityStatusLabel,
  timeSignalLabel,
} from '@/modules/workforce/ui/workforce-calendar-utils';
import styles from './workforce-calendar.module.css';

interface WorkforceDayViewProps {
  day: string;
  people: readonly WorkforcePerson[];
  activities: readonly WorkforceActivitySummary[];
  onOpen(activityId: string): void;
}

function ActivityChip({
  activity,
  onOpen,
}: {
  activity: WorkforceActivitySummary;
  onOpen(activityId: string): void;
}) {
  const alert = timeSignalLabel(activity.timeSignal);

  return (
    <button
      type="button"
      className={styles.activityChip}
      data-status={activity.status}
      data-signal={activity.timeSignal}
      onClick={() => onOpen(activity.id)}
    >
      <strong>{activity.title}</strong>
      <span>{activityStatusLabel(activity.status)}</span>
      {activity.orderNumber ? <small>Pedido {activity.orderNumber}</small> : null}
      {alert ? <small className={styles.alertText}>{alert}</small> : null}
    </button>
  );
}

export function WorkforceDayView({ day, people, activities, onOpen }: WorkforceDayViewProps) {
  return (
    <section aria-label="Cronograma del día" className={styles.daySection}>
      <div className={styles.desktopDay}>
        <div className={styles.dayGrid} role="table" aria-label="Cronograma por franjas horarias">
          <div className={styles.rowContents} role="row">
            <div className={styles.teamHeader} role="columnheader">
              Equipo / Actividad y estado
            </div>
            {workforceDaySlots.map((slot) => (
              <div className={styles.slotHeader} role="columnheader" key={slot.key}>
                {slot.label}
              </div>
            ))}
          </div>

          {people.map((person) => {
            const personActivities = activitiesForDay(activities, person.id, day);
            return (
              <div className={styles.rowContents} role="row" key={person.id}>
                <div className={styles.personCell} role="rowheader">
                  <strong>{person.name}</strong>
                  <span>{person.roles.join(' · ') || 'Sin rol operativo'}</span>
                  <span data-occupancy={person.occupancy}>{occupancyLabel(person.occupancy)}</span>
                  {person.specialTreatment ? (
                    <small>{person.specialTreatmentLabel ?? 'Tratamiento especial'}</small>
                  ) : null}
                </div>
                {workforceDaySlots.map((slot, index) => {
                  const rows = activitiesForSlot(personActivities, index);
                  return (
                    <div className={styles.slotCell} role="cell" key={slot.key}>
                      {rows.length ? (
                        rows.map((activity) => (
                          <ActivityChip activity={activity} onOpen={onOpen} key={activity.id} />
                        ))
                      ) : (
                        <span className={styles.available}>Disponible</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.mobileDay}>
        {people.map((person) => {
          const personActivities = activitiesForDay(activities, person.id, day);
          return (
            <article className={styles.mobilePerson} key={person.id}>
              <header>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.roles.join(' · ') || 'Sin rol operativo'}</span>
                </div>
                <span data-occupancy={person.occupancy}>{occupancyLabel(person.occupancy)}</span>
              </header>
              <div className={styles.mobileTimeline}>
                {workforceDaySlots.map((slot, index) => {
                  const rows = activitiesForSlot(personActivities, index);
                  return (
                    <section key={slot.key}>
                      <h3>{slot.label}</h3>
                      {rows.length ? (
                        rows.map((activity) => (
                          <ActivityChip activity={activity} onOpen={onOpen} key={activity.id} />
                        ))
                      ) : (
                        <span className={styles.available}>Disponible</span>
                      )}
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

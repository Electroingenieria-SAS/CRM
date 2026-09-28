'use client';

import type {
  WorkforceIndicatorsResponse,
  WorkforceScheduleResponse,
} from '@/modules/workforce/application/workforce.schemas';
import { WorkforceDayView } from '@/modules/workforce/ui/workforce-day-view';
import { WorkforceMonthView } from '@/modules/workforce/ui/workforce-month-view';
import { WorkforceWeekView } from '@/modules/workforce/ui/workforce-week-view';
import {
  businessDateLabel,
  workforceRange,
  type WorkforceCalendarMode,
} from '@/modules/workforce/ui/workforce-range';
import styles from './workforce-page.module.css';

export function WorkforcePageHeader({
  canCreate,
  onStartCreate,
}: {
  canCreate: boolean;
  onStartCreate(): void;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className="eyebrow">Personas y productividad</p>
        <h1>Jornada y cronograma</h1>
        <p>Planificación, ocupación y ejecución con horario laboral real.</p>
      </div>
      {canCreate ? (
        <button className="primary-button" type="button" onClick={onStartCreate}>
          Registrar actividad
        </button>
      ) : null}
    </header>
  );
}

export function WorkforceToolbar({
  mode,
  anchor,
  onMode,
  onNavigate,
  onToday,
}: {
  mode: WorkforceCalendarMode;
  anchor: string;
  onMode(mode: WorkforceCalendarMode): void;
  onNavigate(direction: -1 | 1): void;
  onToday(): void;
}) {
  const range = workforceRange(mode, anchor);
  return (
    <section className={styles.toolbar} aria-label="Navegación del cronograma">
      <div className={styles.modeSwitch}>
        {(['day', 'week', 'month'] as const).map((item) => (
          <button
            type="button"
            aria-pressed={mode === item}
            onClick={() => onMode(item)}
            key={item}
          >
            {item === 'day' ? 'Día' : item === 'week' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>
      <div className={styles.navigation}>
        <button type="button" onClick={() => onNavigate(-1)} aria-label="Periodo anterior">
          ←
        </button>
        <button type="button" onClick={onToday}>Hoy</button>
        <button type="button" onClick={() => onNavigate(1)} aria-label="Periodo siguiente">
          →
        </button>
      </div>
      <strong>{mode === 'day' ? businessDateLabel(anchor) : `${range.from} — ${range.to}`}</strong>
    </section>
  );
}

export function WorkforceIndicators({
  indicators,
}: {
  indicators: WorkforceIndicatorsResponse | null;
}) {
  if (!indicators) return null;
  const items = [
    ['Planificadas', indicators.summary.planned],
    ['En curso', indicators.summary.inProgress],
    ['Bloqueadas', indicators.summary.blocked],
    ['Realizadas', indicators.summary.completed],
    ['> 1 hora', indicators.summary.over60Minutes],
  ] as const;

  return (
    <section className={styles.indicators} aria-label="Indicadores básicos">
      {items.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export function WorkforceCalendar({
  mode,
  anchor,
  schedule,
  onOpen,
}: {
  mode: WorkforceCalendarMode;
  anchor: string;
  schedule: WorkforceScheduleResponse;
  onOpen(activityId: string): void;
}) {
  const range = workforceRange(mode, anchor);
  if (mode === 'day') {
    return (
      <WorkforceDayView
        day={anchor}
        people={schedule.people}
        activities={schedule.activities}
        onOpen={onOpen}
      />
    );
  }
  if (mode === 'week') {
    return (
      <WorkforceWeekView
        from={range.from}
        people={schedule.people}
        activities={schedule.activities}
        holidays={schedule.calendar.holidays}
        onOpen={onOpen}
      />
    );
  }
  return (
    <WorkforceMonthView
      from={range.from}
      to={range.to}
      activities={schedule.activities}
      holidays={schedule.calendar.holidays}
      onOpen={onOpen}
    />
  );
}

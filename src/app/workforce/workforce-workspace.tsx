'use client';

import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type {
  CreateWorkforceActivityInput,
  WorkforceActivityDetailResponse,
  WorkforceCatalogItem,
  WorkforceIndicatorsResponse,
  WorkforceScheduleResponse,
} from '@/modules/workforce/application/workforce.schemas';
import { WorkforceCreateForm } from '@/modules/workforce/ui/workforce-create-form';
import { WorkforceDayView } from '@/modules/workforce/ui/workforce-day-view';
import { WorkforceDetail } from '@/modules/workforce/ui/workforce-detail';
import { WorkforceMonthView } from '@/modules/workforce/ui/workforce-month-view';
import { WorkforceWeekView } from '@/modules/workforce/ui/workforce-week-view';
import {
  businessDateLabel,
  workforceRange,
  type WorkforceCalendarMode,
} from '@/modules/workforce/ui/workforce-range';
import { AppShell } from '@/shared/ui/app-shell';
import styles from './workforce-page.module.css';

interface WorkforceWorkspaceProps {
  context: SessionContext;
  catalog: readonly WorkforceCatalogItem[];
  schedule: WorkforceScheduleResponse;
  indicators: WorkforceIndicatorsResponse | null;
  detail: WorkforceActivityDetailResponse | null;
  mode: WorkforceCalendarMode;
  anchor: string;
  creating: boolean;
  loading: boolean;
  busy: boolean;
  message: string | null;
  notice: string | null;
  onMode(mode: WorkforceCalendarMode): void;
  onNavigate(direction: -1 | 1): void;
  onToday(): void;
  onStartCreate(): void;
  onCancelCreate(): void;
  onCreate(input: CreateWorkforceActivityInput): Promise<void>;
  onOpen(activityId: string): void;
  onCloseDetail(): void;
  onAssign(profileId: string | null): Promise<void>;
  onStart(): Promise<void>;
  onBlock(reason: string): Promise<void>;
  onResume(): Promise<void>;
  onComplete(resultNote: string): Promise<void>;
  onCancel(reason: string): Promise<void>;
  onUpload(file: File, evidenceType: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE'): Promise<void>;
  onSignOut(): Promise<void>;
}

export function WorkforceWorkspace(props: WorkforceWorkspaceProps) {
  const canCreate = hasModuleCapability(props.context, 'workforce', 'create');
  const canManage =
    hasModuleCapability(props.context, 'workforce', 'admin') ||
    hasModuleCapability(props.context, 'workforce', 'approve');
  const assignablePeople = canManage
    ? props.schedule.people
    : props.schedule.people.filter((person) => person.id === props.context.profile.id);
  const range = workforceRange(props.mode, props.anchor);

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      onSignOut={props.onSignOut}
    >
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Personas y productividad</p>
          <h1>Jornada y cronograma</h1>
          <p>Planificación, ocupación y ejecución con horario laboral real.</p>
        </div>
        {canCreate ? (
          <button className="primary-button" type="button" onClick={props.onStartCreate}>
            Registrar actividad
          </button>
        ) : null}
      </header>

      <section className={styles.toolbar} aria-label="Navegación del cronograma">
        <div className={styles.modeSwitch}>
          {(['day', 'week', 'month'] as const).map((item) => (
            <button type="button" aria-pressed={props.mode === item} onClick={() => props.onMode(item)} key={item}>
              {item === 'day' ? 'Día' : item === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <div className={styles.navigation}>
          <button type="button" onClick={() => props.onNavigate(-1)} aria-label="Periodo anterior">←</button>
          <button type="button" onClick={props.onToday}>Hoy</button>
          <button type="button" onClick={() => props.onNavigate(1)} aria-label="Periodo siguiente">→</button>
        </div>
        <strong>{props.mode === 'day' ? businessDateLabel(props.anchor) : `${range.from} — ${range.to}`}</strong>
      </section>

      {props.indicators ? (
        <section className={styles.indicators} aria-label="Indicadores básicos">
          <article><span>Planificadas</span><strong>{props.indicators.summary.planned}</strong></article>
          <article><span>En curso</span><strong>{props.indicators.summary.inProgress}</strong></article>
          <article><span>Bloqueadas</span><strong>{props.indicators.summary.blocked}</strong></article>
          <article><span>Realizadas</span><strong>{props.indicators.summary.completed}</strong></article>
          <article><span>&gt; 1 hora</span><strong>{props.indicators.summary.over60Minutes}</strong></article>
        </section>
      ) : null}

      {props.creating && canCreate ? (
        <WorkforceCreateForm
          catalog={props.catalog}
          people={assignablePeople}
          initialDate={props.anchor}
          allowAutoAssign={canManage}
          onCreate={props.onCreate}
          onCancel={props.onCancelCreate}
        />
      ) : null}

      {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}
      {props.message ? <p className={styles.notice} role="alert">{props.message}</p> : null}
      {props.loading ? <p role="status">Actualizando cronograma…</p> : null}

      {!props.loading && props.mode === 'day' ? (
        <WorkforceDayView
          day={props.anchor}
          people={props.schedule.people}
          activities={props.schedule.activities}
          onOpen={props.onOpen}
        />
      ) : null}

      {!props.loading && props.mode === 'week' ? (
        <WorkforceWeekView
          from={range.from}
          people={props.schedule.people}
          activities={props.schedule.activities}
          holidays={props.schedule.calendar.holidays}
          onOpen={props.onOpen}
        />
      ) : null}

      {!props.loading && props.mode === 'month' ? (
        <WorkforceMonthView
          from={range.from}
          to={range.to}
          activities={props.schedule.activities}
          holidays={props.schedule.calendar.holidays}
          onOpen={props.onOpen}
        />
      ) : null}

      {props.detail ? (
        <WorkforceDetail
          detail={props.detail}
          people={assignablePeople}
          busy={props.busy}
          canManage={canManage}
          onClose={props.onCloseDetail}
          onAssign={props.onAssign}
          onStart={props.onStart}
          onBlock={props.onBlock}
          onResume={props.onResume}
          onComplete={props.onComplete}
          onCancel={props.onCancel}
          onUpload={props.onUpload}
        />
      ) : null}
    </AppShell>
  );
}

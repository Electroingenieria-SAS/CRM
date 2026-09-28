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
import { WorkforceDetail } from '@/modules/workforce/ui/workforce-detail';
import type { WorkforceCalendarMode } from '@/modules/workforce/ui/workforce-range';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import {
  WorkforceCalendar,
  WorkforceIndicators,
  WorkforcePageHeader,
  WorkforceToolbar,
} from './workforce-workspace-sections';
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
  onUpload(
    file: File,
    evidenceType: 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE',
  ): Promise<void>;
  onSignOut(): Promise<void>;
}

function navigationFor(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) items.push({ href: '/orders', label: 'Pedidos' });
  if (hasModuleCapability(context, 'customer_intelligence', 'read')) {
    items.push({ href: '/customers/intelligence', label: 'Clientes' });
  }
  if (hasModuleCapability(context, 'freight', 'read')) items.push({ href: '/freight', label: 'Fletes' });
  items.push({ href: '/workforce', label: 'Jornada', current: true });
  return items;
}

export function WorkforceWorkspace(props: WorkforceWorkspaceProps) {
  const canCreate = hasModuleCapability(props.context, 'workforce', 'create');
  const canManage =
    hasModuleCapability(props.context, 'workforce', 'admin') ||
    hasModuleCapability(props.context, 'workforce', 'approve');
  const people = canManage
    ? props.schedule.people
    : props.schedule.people.filter((person) => person.id === props.context.profile.id);

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigationFor(props.context)}
      onSignOut={props.onSignOut}
    >
      <WorkforcePageHeader canCreate={canCreate} onStartCreate={props.onStartCreate} />
      <WorkforceToolbar
        mode={props.mode}
        anchor={props.anchor}
        onMode={props.onMode}
        onNavigate={props.onNavigate}
        onToday={props.onToday}
      />
      <WorkforceIndicators indicators={props.indicators} />

      {props.creating && canCreate ? (
        <WorkforceCreateForm
          catalog={props.catalog}
          people={people}
          initialDate={props.anchor}
          allowAutoAssign={canManage}
          onCreate={props.onCreate}
          onCancel={props.onCancelCreate}
        />
      ) : null}

      {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}
      {props.message ? <p className={styles.notice} role="alert">{props.message}</p> : null}
      {props.loading ? <p role="status">Actualizando cronograma…</p> : null}

      {!props.loading ? (
        <WorkforceCalendar
          mode={props.mode}
          anchor={props.anchor}
          schedule={props.schedule}
          onOpen={props.onOpen}
        />
      ) : null}

      {props.detail ? (
        <WorkforceDetail
          detail={props.detail}
          people={people}
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

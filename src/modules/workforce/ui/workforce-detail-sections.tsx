'use client';

import type {
  WorkforceActivityDetailResponse,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import { activityStatusLabel } from '@/modules/workforce/ui/workforce-calendar-utils';
import { formatBusinessDate } from '@/shared/time/time-zone';
import styles from './workforce-detail.module.css';

export type WorkforceEvidenceType = 'BEFORE_PHOTO' | 'AFTER_PHOTO' | 'FINAL_PHOTO' | 'FILE';

type Activity = WorkforceActivityDetailResponse['activity'];

export function evidenceOptions(
  policy: string,
): readonly (readonly [WorkforceEvidenceType, string])[] {
  if (policy === 'BEFORE_AFTER') {
    return [
      ['BEFORE_PHOTO', 'Foto inicial'],
      ['AFTER_PHOTO', 'Foto final'],
    ];
  }
  if (policy === 'FILE') return [['FILE', 'Archivo']];
  return [['FINAL_PHOTO', 'Foto final']];
}

export function WorkforceDetailHeader({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose(): void;
}) {
  return (
    <header>
      <div>
        <span className="eyebrow">
          {activity.categoryLabel} · {activity.subcategory}
        </span>
        <h2 id="workforce-detail-title">{activity.title}</h2>
        <p>
          {activity.assigneeName} · {activityStatusLabel(activity.status)}
        </p>
      </div>
      <button type="button" onClick={onClose} autoFocus aria-label="Cerrar detalle">
        ×
      </button>
    </header>
  );
}

export function WorkforceDetailFacts({ activity }: { activity: Activity }) {
  const facts = [
    [
      'Horario',
      `${formatBusinessDate(activity.plannedStart)} → ${formatBusinessDate(activity.plannedEnd)}`,
    ],
    [
      'Inicio real',
      activity.actualStart ? formatBusinessDate(activity.actualStart) : 'Sin iniciar',
    ],
    ['Pedido', activity.orderNumber ?? 'Sin pedido relacionado'],
    ['Semáforo', activity.timeSignal === 'OVER_60_MINUTES' ? 'Más de 1 hora' : 'Normal'],
    [
      'Evidencia',
      activity.evidenceComplete ? 'Completa' : `Pendiente · ${activity.evidencePolicy}`,
    ],
    ['Versión', String(activity.version)],
  ] as const;

  return (
    <dl className={styles.facts}>
      {facts.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WorkforcePlannedActions({
  activity,
  people,
  canManage,
  busy,
  assignee,
  onAssignee,
  onAssign,
  onStart,
}: {
  activity: Activity;
  people: readonly WorkforcePerson[];
  canManage: boolean;
  busy: boolean;
  assignee: string;
  onAssignee(value: string): void;
  onAssign(profileId: string | null): Promise<void>;
  onStart(): Promise<void>;
}) {
  if (activity.status !== 'PLANNED') return null;
  return (
    <>
      {canManage ? (
        <>
          <label>
            Responsable
            <select value={assignee} onChange={(event) => onAssignee(event.target.value)}>
              {people.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || assignee === activity.assigneeProfileId}
            onClick={() => void onAssign(assignee)}
          >
            Reasignar
          </button>
        </>
      ) : null}
      <button type="button" disabled={busy} onClick={() => void onStart()}>
        Iniciar actividad
      </button>
    </>
  );
}

export function WorkforceInProgressActions({
  activity,
  busy,
  evidenceType,
  options,
  reason,
  result,
  onEvidenceType,
  onUpload,
  onReason,
  onBlock,
  onResult,
  onComplete,
}: {
  activity: Activity;
  busy: boolean;
  evidenceType: WorkforceEvidenceType;
  options: readonly (readonly [WorkforceEvidenceType, string])[];
  reason: string;
  result: string;
  onEvidenceType(value: WorkforceEvidenceType): void;
  onUpload(file: File, type: WorkforceEvidenceType): Promise<void>;
  onReason(value: string): void;
  onBlock(reason: string): Promise<void>;
  onResult(value: string): void;
  onComplete(result: string): Promise<void>;
}) {
  if (activity.status !== 'IN_PROGRESS') return null;
  return (
    <>
      <label>
        Evidencia
        <select
          value={evidenceType}
          onChange={(event) => onEvidenceType(event.target.value as WorkforceEvidenceType)}
        >
          {options.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.fileInput}>
        Seleccionar archivo
        <input
          type="file"
          accept={evidenceType === 'FILE' ? 'image/*,application/pdf' : 'image/*'}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file, evidenceType);
            event.currentTarget.value = '';
          }}
          disabled={busy}
        />
      </label>
      <label>
        Motivo de bloqueo
        <input value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      <button type="button" disabled={busy || !reason.trim()} onClick={() => void onBlock(reason)}>
        Bloquear
      </button>
      <label>
        Resultado
        <textarea value={result} onChange={(event) => onResult(event.target.value)} rows={2} />
      </label>
      <button type="button" disabled={busy} onClick={() => void onComplete(result)}>
        Finalizar
      </button>
    </>
  );
}

export function WorkforceTerminalActions({
  activity,
  busy,
  cancelReason,
  onResume,
  onCancelReason,
  onCancel,
}: {
  activity: Activity;
  busy: boolean;
  cancelReason: string;
  onResume(): Promise<void>;
  onCancelReason(value: string): void;
  onCancel(reason: string): Promise<void>;
}) {
  const final = ['COMPLETED', 'CANCELLED'].includes(activity.status);
  return (
    <>
      {activity.status === 'BLOCKED' ? (
        <button type="button" disabled={busy} onClick={() => void onResume()}>
          Reanudar
        </button>
      ) : null}
      {!final ? (
        <>
          <label className={styles.cancelField}>
            Motivo de cancelación
            <input value={cancelReason} onChange={(event) => onCancelReason(event.target.value)} />
          </label>
          <button
            type="button"
            className={styles.danger}
            disabled={busy || !cancelReason.trim()}
            onClick={() => void onCancel(cancelReason)}
          >
            Cancelar actividad
          </button>
        </>
      ) : null}
    </>
  );
}

export function WorkforceDetailHistory({ detail }: { detail: WorkforceActivityDetailResponse }) {
  return (
    <>
      <section>
        <h3>Evidencias</h3>
        {detail.evidence.length ? (
          <ul className={styles.timeline}>
            {detail.evidence.map((item) => (
              <li key={item.id}>
                <strong>{item.evidenceType}</strong>
                <span>{item.fileName ?? item.storageReference}</span>
                <small>{formatBusinessDate(item.createdAt)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin evidencias registradas.</p>
        )}
      </section>
      <section>
        <h3>Historial</h3>
        <ol className={styles.timeline}>
          {detail.events.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType}</strong>
              <span>
                {event.fromStatus ?? '—'} → {event.toStatus ?? '—'}
              </span>
              <small>{formatBusinessDate(event.createdAt)}</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

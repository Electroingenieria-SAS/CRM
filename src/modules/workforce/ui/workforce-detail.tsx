'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  WorkforceActivityDetailResponse,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import { activityStatusLabel } from '@/modules/workforce/ui/workforce-calendar-utils';
import { formatBusinessDate } from '@/shared/time/time-zone';
import styles from './workforce-detail.module.css';

interface WorkforceDetailProps {
  detail: WorkforceActivityDetailResponse;
  people: readonly WorkforcePerson[];
  busy: boolean;
  canManage: boolean;
  onClose(): void;
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
}

function evidenceOptions(policy: string) {
  if (policy === 'BEFORE_AFTER') {
    return [
      ['BEFORE_PHOTO', 'Foto inicial'],
      ['AFTER_PHOTO', 'Foto final'],
    ] as const;
  }
  if (policy === 'FILE') return [['FILE', 'Archivo']] as const;
  return [['FINAL_PHOTO', 'Foto final']] as const;
}

export function WorkforceDetail(props: WorkforceDetailProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [assignee, setAssignee] = useState(props.detail.activity.assigneeProfileId);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const options = evidenceOptions(props.detail.activity.evidencePolicy);
  const [evidenceType, setEvidenceType] = useState<(typeof options)[number][0]>(options[0][0]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const activity = props.detail.activity;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="workforce-detail-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClose={props.onClose}
    >
      <div className={styles.panel}>
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
          <button type="button" onClick={props.onClose} autoFocus aria-label="Cerrar detalle">
            ×
          </button>
        </header>

        <dl className={styles.facts}>
          <div>
            <dt>Horario</dt>
            <dd>
              {formatBusinessDate(activity.plannedStart)} →{' '}
              {formatBusinessDate(activity.plannedEnd)}
            </dd>
          </div>
          <div>
            <dt>Inicio real</dt>
            <dd>
              {activity.actualStart ? formatBusinessDate(activity.actualStart) : 'Sin iniciar'}
            </dd>
          </div>
          <div>
            <dt>Pedido</dt>
            <dd>{activity.orderNumber ?? 'Sin pedido relacionado'}</dd>
          </div>
          <div>
            <dt>Semáforo</dt>
            <dd>{activity.timeSignal === 'OVER_60_MINUTES' ? 'Más de 1 hora' : 'Normal'}</dd>
          </div>
          <div>
            <dt>Evidencia</dt>
            <dd>
              {activity.evidenceComplete ? 'Completa' : `Pendiente · ${activity.evidencePolicy}`}
            </dd>
          </div>
          <div>
            <dt>Versión</dt>
            <dd>{activity.version}</dd>
          </div>
        </dl>

        {activity.description ? <p className={styles.description}>{activity.description}</p> : null}

        <section className={styles.actions} aria-label="Acciones de actividad">
          {activity.status === 'PLANNED' ? (
            <>
              {props.canManage ? (
                <>
                  <label>
                    Responsable
                    <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                      {props.people.map((person) => (
                        <option value={person.id} key={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={props.busy || assignee === activity.assigneeProfileId}
                    onClick={() => void props.onAssign(assignee)}
                  >
                    Reasignar
                  </button>
                </>
              ) : null}
              <button type="button" disabled={props.busy} onClick={() => void props.onStart()}>
                Iniciar actividad
              </button>
            </>
          ) : null}

          {activity.status === 'IN_PROGRESS' ? (
            <>
              <label>
                Evidencia
                <select
                  value={evidenceType}
                  onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)}
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
                    if (file) void props.onUpload(file, evidenceType);
                    event.currentTarget.value = '';
                  }}
                  disabled={props.busy}
                />
              </label>
              <label>
                Motivo de bloqueo
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <button
                type="button"
                disabled={props.busy || !reason.trim()}
                onClick={() => void props.onBlock(reason)}
              >
                Bloquear
              </button>
              <label>
                Resultado
                <textarea
                  value={result}
                  onChange={(event) => setResult(event.target.value)}
                  rows={2}
                />
              </label>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => void props.onComplete(result)}
              >
                Finalizar
              </button>
            </>
          ) : null}

          {activity.status === 'BLOCKED' ? (
            <button type="button" disabled={props.busy} onClick={() => void props.onResume()}>
              Reanudar
            </button>
          ) : null}

          {!['COMPLETED', 'CANCELLED'].includes(activity.status) ? (
            <>
              <label className={styles.cancelField}>
                Motivo de cancelación
                <input
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.danger}
                disabled={props.busy || !cancelReason.trim()}
                onClick={() => void props.onCancel(cancelReason)}
              >
                Cancelar actividad
              </button>
            </>
          ) : null}
        </section>

        <section>
          <h3>Evidencias</h3>
          {props.detail.evidence.length ? (
            <ul className={styles.timeline}>
              {props.detail.evidence.map((item) => (
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
            {props.detail.events.map((event) => (
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
      </div>
    </dialog>
  );
}

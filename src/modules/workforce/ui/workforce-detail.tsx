'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  WorkforceActivityDetailResponse,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import {
  evidenceOptions,
  WorkforceDetailFacts,
  WorkforceDetailHeader,
  WorkforceDetailHistory,
  WorkforceInProgressActions,
  WorkforcePlannedActions,
  WorkforceTerminalActions,
  type WorkforceEvidenceType,
} from './workforce-detail-sections';
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
  onUpload(file: File, evidenceType: WorkforceEvidenceType): Promise<void>;
}

export function WorkforceDetail(props: WorkforceDetailProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const activity = props.detail.activity;
  const options = evidenceOptions(activity.evidencePolicy);
  const [assignee, setAssignee] = useState(activity.assigneeProfileId);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [evidenceType, setEvidenceType] = useState<WorkforceEvidenceType>(options[0][0]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

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
        <WorkforceDetailHeader activity={activity} onClose={props.onClose} />
        <WorkforceDetailFacts activity={activity} />
        {activity.description ? <p className={styles.description}>{activity.description}</p> : null}

        <section className={styles.actions} aria-label="Acciones de actividad">
          <WorkforcePlannedActions
            activity={activity}
            people={props.people}
            canManage={props.canManage}
            busy={props.busy}
            assignee={assignee}
            onAssignee={setAssignee}
            onAssign={props.onAssign}
            onStart={props.onStart}
          />
          <WorkforceInProgressActions
            activity={activity}
            busy={props.busy}
            evidenceType={evidenceType}
            options={options}
            reason={reason}
            result={result}
            onEvidenceType={setEvidenceType}
            onUpload={props.onUpload}
            onReason={setReason}
            onBlock={props.onBlock}
            onResult={setResult}
            onComplete={props.onComplete}
          />
          <WorkforceTerminalActions
            activity={activity}
            busy={props.busy}
            cancelReason={cancelReason}
            onResume={props.onResume}
            onCancelReason={setCancelReason}
            onCancel={props.onCancel}
          />
        </section>

        <WorkforceDetailHistory detail={props.detail} />
      </div>
    </dialog>
  );
}

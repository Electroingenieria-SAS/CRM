'use client';

import { useState } from 'react';
import type { OrderDetailResponse } from '@/modules/orders/application/order.schemas';
import { OpenOrderIssues } from '@/modules/orders/ui/open-order-issues';
import styles from './order-workflow-panel.module.css';

interface Props {
  detail: OrderDetailResponse;
  busy: boolean;
  onCreateIssue(input: {
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blocking: boolean;
    title: string;
    description: string;
  }): Promise<void>;
  onResolveIssue(issueId: string, resolution: string): Promise<void>;
}

export function OrderIssuesPanel({ detail, busy, onCreateIssue, onResolveIssue }: Props) {
  const firstType = detail.workflow.issueTypes[0];
  const [issueType, setIssueType] = useState(firstType?.code ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [blocking, setBlocking] = useState(firstType?.defaultBlocking ?? false);
  const openIssues = detail.issues.filter((item) => item.status === 'OPEN');
  const selectedType =
    detail.workflow.issueTypes.find((item) => item.code === issueType) ?? firstType;

  return (
    <>
      <details className={styles.actionBox}>
        <summary>Registrar incidencia</summary>
        <label>
          Tipo
          <select
            value={issueType}
            onChange={(event) => {
              const next = detail.workflow.issueTypes.find(
                (item) => item.code === event.target.value,
              );
              setIssueType(event.target.value);
              setBlocking(next?.defaultBlocking ?? false);
            }}
          >
            {detail.workflow.issueTypes.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Descripción
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={blocking}
            onChange={(event) => setBlocking(event.target.checked)}
          />
          Incidencia bloqueante
        </label>
        <button
          type="button"
          disabled={
            busy || !selectedType || title.trim().length < 3 || description.trim().length < 3
          }
          onClick={() =>
            selectedType &&
            onCreateIssue({
              type: selectedType.code,
              severity: selectedType.defaultSeverity,
              blocking,
              title,
              description,
            })
          }
        >
          Guardar incidencia
        </button>
      </details>

      <OpenOrderIssues issues={openIssues} busy={busy} onResolveIssue={onResolveIssue} />
    </>
  );
}

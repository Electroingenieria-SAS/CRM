'use client';

import { useState } from 'react';
import styles from './order-workflow-panel.module.css';

interface Props {
  issues: Array<Record<string, unknown>>;
  busy: boolean;
  onResolveIssue(issueId: string, resolution: string): Promise<void>;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function OpenOrderIssues({ issues, busy, onResolveIssue }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  if (issues.length === 0) return null;

  return (
    <section className={styles.issues}>
      <h4>Incidencias abiertas</h4>
      {issues.map((issue) => {
        const id = text(issue.id);
        return (
          <article key={id}>
            <div>
              <strong>{text(issue.title)}</strong>
              <span>{text(issue.severity)}</span>
            </div>
            <p>{text(issue.description)}</p>
            <label>
              Resolución
              <textarea
                value={resolutions[id] ?? ''}
                onChange={(event) =>
                  setResolutions((current) => ({ ...current, [id]: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              disabled={busy || (resolutions[id] ?? '').trim().length < 3}
              onClick={() => onResolveIssue(id, resolutions[id] ?? '')}
            >
              Resolver incidencia
            </button>
          </article>
        );
      })}
    </section>
  );
}

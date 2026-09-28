'use client';

import { useMemo, useState } from 'react';
import type {
  CreateWorkforceActivityInput,
  WorkforceCatalogItem,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import styles from './workforce-form.module.css';

interface WorkforceCreateFormProps {
  catalog: readonly WorkforceCatalogItem[];
  people: readonly WorkforcePerson[];
  initialDate: string;
  allowAutoAssign: boolean;
  onCreate(input: CreateWorkforceActivityInput): Promise<void>;
  onCancel(): void;
}

function localColombiaIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Fecha y hora inválidas.');
  }
  return `${value}:00-05:00`;
}

export function WorkforceCreateForm({
  catalog,
  people,
  initialDate,
  allowAutoAssign,
  onCreate,
  onCancel,
}: WorkforceCreateFormProps) {
  const categories = useMemo(
    () => [...new Map(catalog.map((item) => [item.categoryCode, item.categoryLabel])).entries()],
    [catalog],
  );
  const [category, setCategory] = useState(categories[0]?.[0] ?? '');
  const subcategories = useMemo(
    () => [
      ...new Set(
        catalog.filter((item) => item.categoryCode === category).map((item) => item.subcategory),
      ),
    ],
    [catalog, category],
  );
  const [subcategory, setSubcategory] = useState(subcategories[0] ?? '');
  const activities = catalog.filter(
    (item) => item.categoryCode === category && item.subcategory === subcategory,
  );
  const [catalogId, setCatalogId] = useState(activities[0]?.id ?? '');
  const [assignee, setAssignee] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [start, setStart] = useState(`${initialDate}T07:00`);
  const [end, setEnd] = useState(`${initialDate}T09:00`);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  function selectCategory(next: string) {
    setCategory(next);
    const sub = catalog.find((item) => item.categoryCode === next)?.subcategory ?? '';
    setSubcategory(sub);
    setCatalogId(
      catalog.find((item) => item.categoryCode === next && item.subcategory === sub)?.id ?? '',
    );
  }

  function selectSubcategory(next: string) {
    setSubcategory(next);
    setCatalogId(
      catalog.find((item) => item.categoryCode === category && item.subcategory === next)?.id ?? '',
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!catalogId) return;
    setBusy(true);
    try {
      await onCreate({
        catalogId,
        ...(autoAssign ? { autoAssign: true } : {}),
        ...(!autoAssign && assignee ? { assigneeProfileId: assignee } : {}),
        plannedStart: localColombiaIso(start),
        plannedEnd: localColombiaIso(end),
        description: description.trim() || undefined,
        metadata: {},
      } as CreateWorkforceActivityInput);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <header>
        <div>
          <span className="eyebrow">Planificación</span>
          <h2>Nueva actividad</h2>
        </div>
        <button type="button" onClick={onCancel}>
          Cerrar
        </button>
      </header>

      <div className={styles.grid}>
        <label>
          Categoría
          <select value={category} onChange={(event) => selectCategory(event.target.value)}>
            {categories.map(([code, label]) => (
              <option value={code} key={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subcategoría
          <select value={subcategory} onChange={(event) => selectSubcategory(event.target.value)}>
            {subcategories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.full}>
          Actividad específica
          <select value={catalogId} onChange={(event) => setCatalogId(event.target.value)}>
            {activities.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inicio
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </label>
        <label>
          Fin
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            required
          />
        </label>
        <label className={styles.full}>
          Responsable
          <select
            value={assignee}
            disabled={autoAssign}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">Yo mismo</option>
            {people.map((person) => (
              <option value={person.id} key={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        {allowAutoAssign ? (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(event) => setAutoAssign(event.target.checked)}
            />
            Autoasignar a una persona disponible compatible
          </label>
        ) : null}
        <label className={styles.full}>
          Descripción
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </label>
      </div>

      <footer>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={busy || !catalogId}>
          {busy ? 'Guardando…' : 'Planificar actividad'}
        </button>
      </footer>
    </form>
  );
}

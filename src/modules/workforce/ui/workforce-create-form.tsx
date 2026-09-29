'use client';

import type {
  CreateWorkforceActivityInput,
  WorkforceCatalogItem,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import { useWorkforceCreateForm } from './use-workforce-create-form';
import styles from './workforce-form.module.css';

interface WorkforceCreateFormProps {
  catalog: readonly WorkforceCatalogItem[];
  people: readonly WorkforcePerson[];
  initialDate: string;
  allowAutoAssign: boolean;
  onCreate(input: CreateWorkforceActivityInput): Promise<void>;
  onCancel(): void;
}

function CatalogFields({ form }: { form: ReturnType<typeof useWorkforceCreateForm> }) {
  return (
    <>
      <label>
        Categoría
        <select value={form.category} onChange={(event) => form.selectCategory(event.target.value)}>
          {form.categories.map(([code, label]) => (
            <option value={code} key={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subcategoría
        <select
          value={form.subcategory}
          onChange={(event) => form.selectSubcategory(event.target.value)}
        >
          {form.subcategories.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.full}>
        Actividad específica
        <select value={form.catalogId} onChange={(event) => form.setCatalogId(event.target.value)}>
          {form.activities.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function TimingFields({ form }: { form: ReturnType<typeof useWorkforceCreateForm> }) {
  return (
    <>
      <label>
        Inicio
        <input
          type="datetime-local"
          value={form.start}
          onChange={(event) => form.setStart(event.target.value)}
          required
        />
      </label>
      <label>
        Fin
        <input
          type="datetime-local"
          value={form.end}
          onChange={(event) => form.setEnd(event.target.value)}
          required
        />
      </label>
    </>
  );
}

function AssignmentFields({
  form,
  people,
  allowAutoAssign,
}: {
  form: ReturnType<typeof useWorkforceCreateForm>;
  people: readonly WorkforcePerson[];
  allowAutoAssign: boolean;
}) {
  return (
    <>
      <label className={styles.full}>
        Responsable
        <select
          value={form.assignee}
          disabled={form.autoAssign}
          onChange={(event) => form.setAssignee(event.target.value)}
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
            checked={form.autoAssign}
            onChange={(event) => form.setAutoAssign(event.target.checked)}
          />
          Autoasignar a una persona disponible compatible
        </label>
      ) : null}
    </>
  );
}

export function WorkforceCreateForm(props: WorkforceCreateFormProps) {
  const form = useWorkforceCreateForm(props.catalog, props.initialDate, props.onCreate);
  return (
    <form className={styles.form} onSubmit={(event) => void form.submit(event)}>
      <header>
        <div>
          <span className="eyebrow">Planificación</span>
          <h2>Nueva actividad</h2>
        </div>
        <button type="button" onClick={props.onCancel}>
          Cerrar
        </button>
      </header>

      <div className={styles.grid}>
        <CatalogFields form={form} />
        <TimingFields form={form} />
        <AssignmentFields
          form={form}
          people={props.people}
          allowAutoAssign={props.allowAutoAssign}
        />
        <label className={styles.full}>
          Descripción
          <textarea
            value={form.description}
            onChange={(event) => form.setDescription(event.target.value)}
            rows={3}
          />
        </label>
      </div>

      <footer>
        <button type="button" onClick={props.onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={form.busy || !form.catalogId}>
          {form.busy ? 'Guardando…' : 'Planificar actividad'}
        </button>
      </footer>
    </form>
  );
}

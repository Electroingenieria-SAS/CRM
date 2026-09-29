'use client';

import type { ReturnTypeOfPacoWizard } from './paco-activity-wizard';
import styles from './paco.module.css';

export function PacoWizardClassification({ data }: { data: ReturnTypeOfPacoWizard }) {
  if (data.step === 0) {
    return (
      <div className={styles.choiceGrid}>
        <button type="button" onClick={() => { data.setKind('ACTIVITY'); data.setStep(1); }}>Actividad</button>
        <button type="button" onClick={() => { data.setKind('DELIVERABLE'); data.setStep(1); }}>Entregable</button>
      </div>
    );
  }
  if (data.step === 1) {
    return (
      <label>
        Categoría
        <select value={data.category} onChange={(event) => data.setCategory(event.target.value)}>
          <option value="">Seleccionar</option>
          {data.categories.map((value) => <option key={value}>{value}</option>)}
        </select>
        <button disabled={!data.category} type="button" onClick={() => data.setStep(2)}>Continuar</button>
      </label>
    );
  }
  if (data.step !== 2) return null;
  return (
    <label>
      Actividad específica
      <select value={data.catalogId} onChange={(event) => data.setCatalogId(event.target.value)}>
        <option value="">Seleccionar</option>
        {data.activities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button disabled={!data.catalogId} type="button" onClick={() => data.setStep(3)}>Continuar</button>
    </label>
  );
}

export function PacoWizardContext({ data }: { data: ReturnTypeOfPacoWizard }) {
  if (data.step === 3) {
    return (
      <label>
        Pedido, si aplica
        <input
          value={data.orderReference}
          placeholder="Ej. PVN-1048"
          onChange={(event) => data.setOrderReference(event.target.value)}
        />
        <button disabled={data.busy} type="button" onClick={() => void data.resolveOrder()}>
          {data.orderReference.trim() ? 'Validar pedido' : 'Continuar sin pedido'}
        </button>
      </label>
    );
  }
  if (data.step !== 4) return null;
  return (
    <label>
      Responsable
      <select value={data.assignee} onChange={(event) => data.setAssignee(event.target.value)}>
        <option value="">Seleccionar</option>
        {data.people.map((person) => (
          <option key={person.id} value={person.id}>{person.name} · {person.occupancy}</option>
        ))}
      </select>
      <button disabled={!data.assignee} type="button" onClick={() => data.setStep(5)}>Continuar</button>
    </label>
  );
}

export function PacoWizardSchedule({ data }: { data: ReturnTypeOfPacoWizard }) {
  if (data.step === 5) {
    return (
      <div className={styles.timeGrid}>
        <label>Inicio<input type="datetime-local" value={data.start} onChange={(event) => data.setStart(event.target.value)} /></label>
        <label>Fin<input type="datetime-local" value={data.end} onChange={(event) => data.setEnd(event.target.value)} /></label>
        <button type="button" onClick={() => data.setStep(6)}>Revisar</button>
      </div>
    );
  }
  if (data.step !== 6) return null;
  return (
    <div className={styles.confirm}>
      <strong>Confirmar registro</strong>
      <span>{data.catalog.find((item) => item.id === data.catalogId)?.name}</span>
      <span>{data.people.find((person) => person.id === data.assignee)?.name}</span>
      <span>{data.orderLabel ? `Pedido ${data.orderLabel}` : 'Sin pedido asociado'}</span>
      <span>{data.start} → {data.end}</span>
      <button disabled={data.busy} type="button" onClick={() => void data.create()}>
        {data.busy ? 'Registrando…' : 'Confirmar actividad'}
      </button>
    </div>
  );
}

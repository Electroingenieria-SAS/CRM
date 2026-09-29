'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PacoService } from '@/modules/assistant/application/paco-service';
import type {
  WorkforceCatalogItem,
  WorkforcePerson,
} from '@/modules/workforce/application/workforce.schemas';
import styles from './paco.module.css';

interface ActivityWizardProps {
  paco: PacoService;
  onCancel(): void;
  onComplete(message: string): void;
}

function localInputValue(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PacoActivityWizard({ paco, onCancel, onComplete }: ActivityWizardProps) {
  const [catalog, setCatalog] = useState<WorkforceCatalogItem[]>([]);
  const [people, setPeople] = useState<WorkforcePerson[]>([]);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'ACTIVITY' | 'DELIVERABLE'>('ACTIVITY');
  const [category, setCategory] = useState('');
  const [catalogId, setCatalogId] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [orderId, setOrderId] = useState<string | undefined>();
  const [orderLabel, setOrderLabel] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');
  const [start, setStart] = useState(localInputValue());
  const [end, setEnd] = useState(localInputValue(60));
  const [message, setMessage] = useState<string | null>('Cargando opciones…');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    void paco
      .activitySetup()
      .then((setup) => {
        if (!active) return;
        setCatalog(setup.catalog);
        setPeople(setup.people);
        setMessage(null);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No pude cargar actividades.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [paco]);

  const categories = useMemo(
    () =>
      [...new Set(catalog.filter((item) => item.activityKind === kind).map((item) => item.categoryCode))].sort(),
    [catalog, kind],
  );
  const activities = catalog.filter(
    (item) => item.activityKind === kind && item.categoryCode === category,
  );

  async function resolveOrderAndContinue() {
    if (!orderReference.trim()) {
      setOrderId(undefined);
      setOrderLabel(null);
      setStep(4);
      return;
    }
    setBusy(true);
    try {
      const order = await paco.resolveOrder(orderReference);
      if (!order) {
        setMessage('No encontré ese pedido. Corrige la referencia o continúa sin pedido.');
        return;
      }
      setOrderId(order.id);
      setOrderLabel(order.orderNumber);
      setMessage(null);
      setStep(4);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!catalogId || !assignee) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await paco.createActivity({
        catalogId,
        assigneeProfileId: assignee,
        plannedStart: new Date(start).toISOString(),
        plannedEnd: new Date(end).toISOString(),
        orderId,
      });
      onComplete(`Actividad registrada correctamente: ${result.activityId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pude registrar la actividad.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.wizard} aria-label="Registro guiado de actividad">
      <div className={styles.wizardHeader}>
        <strong>Registrar actividad</strong>
        <button type="button" onClick={onCancel}>Cancelar consulta</button>
      </div>
      {message ? <p role="status">{message}</p> : null}

      {step === 0 ? (
        <div className={styles.choiceGrid}>
          <button type="button" onClick={() => { setKind('ACTIVITY'); setStep(1); }}>Actividad</button>
          <button type="button" onClick={() => { setKind('DELIVERABLE'); setStep(1); }}>Entregable</button>
        </div>
      ) : null}

      {step === 1 ? (
        <label>
          Categoría
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Seleccionar</option>
            {categories.map((value) => <option key={value}>{value}</option>)}
          </select>
          <button disabled={!category} type="button" onClick={() => setStep(2)}>Continuar</button>
        </label>
      ) : null}

      {step === 2 ? (
        <label>
          Actividad específica
          <select value={catalogId} onChange={(event) => setCatalogId(event.target.value)}>
            <option value="">Seleccionar</option>
            {activities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button disabled={!catalogId} type="button" onClick={() => setStep(3)}>Continuar</button>
        </label>
      ) : null}

      {step === 3 ? (
        <label>
          Pedido, si aplica
          <input
            value={orderReference}
            placeholder="Ej. PVN-1048"
            onChange={(event) => setOrderReference(event.target.value)}
          />
          <button disabled={busy} type="button" onClick={() => void resolveOrderAndContinue()}>
            {orderReference.trim() ? 'Validar pedido' : 'Continuar sin pedido'}
          </button>
        </label>
      ) : null}

      {step === 4 ? (
        <label>
          Responsable
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Seleccionar</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.occupancy}
              </option>
            ))}
          </select>
          <button disabled={!assignee} type="button" onClick={() => setStep(5)}>Continuar</button>
        </label>
      ) : null}

      {step === 5 ? (
        <div className={styles.timeGrid}>
          <label>
            Inicio
            <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            Fin
            <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
          <button type="button" onClick={() => setStep(6)}>Revisar</button>
        </div>
      ) : null}

      {step === 6 ? (
        <div className={styles.confirm}>
          <strong>Confirmar registro</strong>
          <span>{catalog.find((item) => item.id === catalogId)?.name}</span>
          <span>{people.find((person) => person.id === assignee)?.name}</span>
          <span>{orderLabel ? `Pedido ${orderLabel}` : 'Sin pedido asociado'}</span>
          <span>{start} → {end}</span>
          <button disabled={busy} type="button" onClick={() => void create()}>
            {busy ? 'Registrando…' : 'Confirmar actividad'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

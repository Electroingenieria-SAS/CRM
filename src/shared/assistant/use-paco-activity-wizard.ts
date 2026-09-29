'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PacoService } from '@/modules/assistant/application/paco-service';
import type { WorkforceCatalogItem, WorkforcePerson } from '@/modules/workforce/application/workforce.schemas';

function localInputValue(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function usePacoActivityWizard(paco: PacoService, onComplete: (message: string) => void) {
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
    void paco.activitySetup().then((setup) => {
      if (!active) return;
      setCatalog(setup.catalog);
      setPeople(setup.people);
      setMessage(null);
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'No pude cargar actividades.');
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [paco]);

  const categories = useMemo(
    () => [...new Set(catalog.filter((item) => item.activityKind === kind).map((item) => item.categoryCode))].sort(),
    [catalog, kind],
  );
  const activities = catalog.filter((item) => item.activityKind === kind && item.categoryCode === category);

  async function resolveOrder() {
    if (!orderReference.trim()) {
      setOrderId(undefined); setOrderLabel(null); setStep(4); return;
    }
    setBusy(true);
    try {
      const order = await paco.resolveOrder(orderReference);
      if (!order) {
        setMessage('No encontré ese pedido. Corrige la referencia o continúa sin pedido.');
        return;
      }
      setOrderId(order.id); setOrderLabel(order.orderNumber); setMessage(null); setStep(4);
    } finally { setBusy(false); }
  }

  async function create() {
    if (!catalogId || !assignee) return;
    setBusy(true); setMessage(null);
    try {
      const result = await paco.createActivity({
        catalogId, assigneeProfileId: assignee,
        plannedStart: new Date(start).toISOString(),
        plannedEnd: new Date(end).toISOString(), orderId,
      });
      onComplete(`Actividad registrada correctamente: ${result.activityId}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pude registrar la actividad.');
    } finally { setBusy(false); }
  }

  return {
    catalog, people, step, setStep, kind, setKind, category, setCategory, catalogId, setCatalogId,
    orderReference, setOrderReference, orderLabel, assignee, setAssignee, start, setStart, end, setEnd,
    message, busy, categories, activities, resolveOrder, create,
  };
}

export type PacoWizardData = ReturnType<typeof usePacoActivityWizard>;

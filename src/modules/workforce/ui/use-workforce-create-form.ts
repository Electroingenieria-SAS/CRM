'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type {
  CreateWorkforceActivityInput,
  WorkforceCatalogItem,
} from '@/modules/workforce/application/workforce.schemas';

function localColombiaIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Fecha y hora inválidas.');
  }
  return `${value}:00-05:00`;
}

export function useWorkforceCreateForm(
  catalog: readonly WorkforceCatalogItem[],
  initialDate: string,
  onCreate: (input: CreateWorkforceActivityInput) => Promise<void>,
) {
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

  async function submit(event: FormEvent) {
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
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    categories, category, subcategories, subcategory, activities, catalogId, assignee,
    autoAssign, start, end, description, busy, selectCategory, selectSubcategory,
    setCatalogId, setAssignee, setAutoAssign, setStart, setEnd, setDescription, submit,
  };
}

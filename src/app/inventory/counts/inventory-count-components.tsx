'use client';

import { useState, type FormEvent } from 'react';
import type { InventoryCountCandidates } from '@/modules/inventory/application/inventory.schemas';
import styles from './inventory-count.module.css';

type Candidate = InventoryCountCandidates['items'][number];

export function InventoryCountCandidatesGrid(props: {
  items: Candidate[];
  selectedBalanceId: string | null;
  select(value: string): void;
}) {
  return (
    <section className={styles.grid} aria-label="Referencias para conteo">
      {props.items.map((item) => (
        <article
          className={
            item.balanceId === props.selectedBalanceId
              ? [styles.card, styles.selected].join(' ')
              : styles.card
          }
          key={item.balanceId}
        >
          <strong>{item.reference}</strong>
          <p>{item.name}</p>
          {item.variantLabel ? <small>{item.variantLabel}</small> : null}
          <span>
            {item.locationCode} · {item.locationName}
          </span>
          <span>Unidad: {item.unit}</span>
          <button type="button" onClick={() => props.select(item.balanceId)}>
            Contar
          </button>
        </article>
      ))}
    </section>
  );
}

export function InventoryCountCapture(props: {
  selected: Candidate;
  busy: boolean;
  submit(countedQuantity: number, note: string): Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await props.submit(Number(quantity), note);
    setQuantity('');
    setNote('');
  }

  return (
    <form className={styles.countForm} onSubmit={(event) => void submit(event)}>
      <h2>Registrar conteo · {props.selected.reference}</h2>
      <p>
        {props.selected.locationCode} · {props.selected.locationName}
      </p>
      <label>
        Cantidad contada ({props.selected.unit})
        <input
          type="number"
          min="0"
          step="0.0001"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
      </label>
      <label>
        Observación
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
      </label>
      <button type="submit" disabled={props.busy}>
        Enviar conteo
      </button>
    </form>
  );
}

export function InventoryCountPagination(props: {
  pagination: InventoryCountCandidates['pagination'];
  goPage(page: number): Promise<void>;
}) {
  const { page, totalPages } = props.pagination;
  return (
    <nav className={styles.pagination} aria-label="Paginación de conteos">
      <button type="button" disabled={page <= 1} onClick={() => void props.goPage(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {Math.max(totalPages, 1)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => void props.goPage(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}

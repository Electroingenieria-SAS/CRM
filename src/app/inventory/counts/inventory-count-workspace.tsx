'use client';

import { useState, type FormEvent } from 'react';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { InventoryCountCandidates } from '@/modules/inventory/application/inventory.schemas';
import { AppShell } from '@/shared/ui/app-shell';
import styles from './inventory-count.module.css';

interface Props {
  context: SessionContext;
  data: InventoryCountCandidates;
  search: string;
  selectedBalanceId: string | null;
  loading: boolean;
  busy: boolean;
  message: string | null;
  notice: string | null;
  setSearch(value: string): void;
  select(value: string | null): void;
  searchNow(): Promise<void>;
  goPage(page: number): Promise<void>;
  submit(countedQuantity: number, note: string): Promise<void>;
  signOut(): Promise<void>;
}

export function InventoryCountWorkspace(props: Props) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const selected = props.data.items.find((item) => item.balanceId === props.selectedBalanceId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await props.submit(Number(quantity), note);
    setQuantity('');
    setNote('');
  }

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={[
        { href: '/orders', label: 'Pedidos' },
        { href: '/inventory', label: 'Inventario' },
        { href: '/inventory/counts', label: 'Conteos', current: true },
      ]}
      onSignOut={props.signOut}
    >
      <div className={styles.workspace}>
        <header>
          <p className="eyebrow">Inventario · Conteo físico</p>
          <h1>Conteo ciego</h1>
          <p>Registra lo observado físicamente. El saldo teórico no se muestra durante la captura.</p>
        </header>

        <form
          className={styles.filters}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void props.searchNow();
          }}
        >
          <label>
            Buscar material o ubicación
            <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} />
          </label>
          <button type="submit" disabled={props.loading}>Buscar</button>
        </form>

        {props.notice ? <p className={styles.notice} role="status">{props.notice}</p> : null}
        {props.message ? <p className={styles.error} role="alert">{props.message}</p> : null}

        <section className={styles.grid} aria-label="Referencias para conteo">
          {props.data.items.map((item) => (
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
              <span>{item.locationCode} · {item.locationName}</span>
              <span>Unidad: {item.unit}</span>
              <button type="button" onClick={() => props.select(item.balanceId)}>Contar</button>
            </article>
          ))}
        </section>

        {selected ? (
          <form className={styles.countForm} onSubmit={(event) => void submit(event)}>
            <h2>Registrar conteo · {selected.reference}</h2>
            <p>{selected.locationCode} · {selected.locationName}</p>
            <label>
              Cantidad contada ({selected.unit})
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
            <button type="submit" disabled={props.busy}>Enviar conteo</button>
          </form>
        ) : null}

        <nav className={styles.pagination} aria-label="Paginación de conteos">
          <button
            type="button"
            disabled={props.data.pagination.page <= 1}
            onClick={() => void props.goPage(props.data.pagination.page - 1)}
          >
            Anterior
          </button>
          <span>
            Página {props.data.pagination.page} de {Math.max(props.data.pagination.totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={props.data.pagination.page >= props.data.pagination.totalPages}
            onClick={() => void props.goPage(props.data.pagination.page + 1)}
          >
            Siguiente
          </button>
        </nav>
      </div>
    </AppShell>
  );
}

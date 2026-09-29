'use client';

import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { InventoryCountCandidates } from '@/modules/inventory/application/inventory.schemas';
import {
  InventoryCountCandidatesGrid,
  InventoryCountCapture,
  InventoryCountPagination,
} from '@/app/inventory/counts/inventory-count-components';
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
  const selected = props.data.items.find((item) => item.balanceId === props.selectedBalanceId);

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
          <p>
            Registra lo observado físicamente. El saldo teórico no se muestra durante la captura.
          </p>
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
          <button type="submit" disabled={props.loading}>
            Buscar
          </button>
        </form>

        {props.notice ? (
          <p className={styles.notice} role="status">
            {props.notice}
          </p>
        ) : null}
        {props.message ? (
          <p className={styles.error} role="alert">
            {props.message}
          </p>
        ) : null}

        <InventoryCountCandidatesGrid
          items={props.data.items}
          selectedBalanceId={props.selectedBalanceId}
          select={props.select}
        />
        {selected ? (
          <InventoryCountCapture selected={selected} busy={props.busy} submit={props.submit} />
        ) : null}
        <InventoryCountPagination pagination={props.data.pagination} goPage={props.goPage} />
      </div>
    </AppShell>
  );
}

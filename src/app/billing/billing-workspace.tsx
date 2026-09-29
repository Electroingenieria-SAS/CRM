'use client';

import { useState, type FormEvent } from 'react';
import { hasModuleCapability } from '@/modules/auth/application/session-permissions';
import type { SessionContext } from '@/modules/auth/application/session.schemas';
import type { BillingQueue, BillingQueueItem } from '@/modules/billing/application/billing.schemas';
import type { InvoiceInput } from '@/modules/finance/ports/finance-repository';
import { AppShell, type AppShellNavigationItem } from '@/shared/ui/app-shell';
import styles from './billing-page.module.css';

interface BillingWorkspaceProps {
  context: SessionContext;
  queue: BillingQueue;
  selected: BillingQueueItem | null;
  search: string;
  busy: boolean;
  message: string | null;
  notice: string | null;
  onSelect(item: BillingQueueItem): void;
  onSearchChange(value: string): void;
  onSearch(): void;
  onRegisterInvoice(item: BillingQueueItem, input: InvoiceInput): Promise<void>;
  onUploadPvpAnnex(item: BillingQueueItem, file: File): Promise<void>;
  onComplete(item: BillingQueueItem): Promise<void>;
  onSignOut(): Promise<void>;
}

function navigation(context: SessionContext): AppShellNavigationItem[] {
  const items: AppShellNavigationItem[] = [];
  if (hasModuleCapability(context, 'orders', 'read')) {
    items.push({ href: '/orders', label: 'Pedidos' });
  }
  items.push({ href: '/billing', label: 'Facturación', current: true });
  if (hasModuleCapability(context, 'shipping', 'read')) {
    items.push({ href: '/logistics', label: 'Logística' });
  }
  if (hasModuleCapability(context, 'freight', 'read')) {
    items.push({ href: '/freight', label: 'Fletes' });
  }
  return items;
}

function BillingQueueCards(props: {
  queue: BillingQueue;
  selectedId?: string;
  onSelect(item: BillingQueueItem): void;
}) {
  if (!props.queue.items.length) {
    return <p className={styles.empty}>No hay pedidos pendientes de facturación.</p>;
  }

  return (
    <div className={styles.cards}>
      {props.queue.items.map((item) => (
        <button
          type="button"
          key={item.orderId}
          className={item.orderId === props.selectedId ? styles.selectedCard : styles.card}
          onClick={() => props.onSelect(item)}
        >
          <span className={styles.cardTop}>
            <strong>{item.orderNumber}</strong>
            <span>{item.currentStep.replaceAll('_', ' ')}</span>
          </span>
          <span>{item.customerName}</span>
          <small>
            {item.orderType} · {item.routeCode.replaceAll('_', ' ')}
          </small>
          <small>
            {item.billingReady ? 'Documento listo' : 'Documento pendiente'} ·{' '}
            {item.financial.decision}
          </small>
        </button>
      ))}
    </div>
  );
}

function InvoiceForm(props: {
  item: BillingQueueItem;
  busy: boolean;
  onSubmit(input: InvoiceInput): Promise<void>;
}) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [supportId, setSupportId] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void props.onSubmit({
      invoiceNumber: number.trim(),
      invoiceDate: date || undefined,
      amount: Number(amount),
      supportId: supportId || undefined,
      metadata: { source: 'BILLING_UI' },
    });
  };

  const supports = props.item.supports.filter(
    (support) => support.validationStatus === 'VALIDATED',
  );

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        Número de factura
        <input required value={number} onChange={(event) => setNumber(event.target.value)} />
      </label>
      <label>
        Fecha
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label>
        Valor registrado
        <input
          required
          inputMode="decimal"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label>
        Soporte validado
        <select value={supportId} onChange={(event) => setSupportId(event.target.value)}>
          <option value="">Sin asociar</option>
          {supports.map((support) => (
            <option key={support.id} value={support.id}>
              {support.supportType} · {new Date(support.createdAt).toLocaleDateString('es-CO')}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={props.busy}>
        Registrar factura
      </button>
    </form>
  );
}

function BillingDetail(
  props: Pick<
    BillingWorkspaceProps,
    'selected' | 'busy' | 'onRegisterInvoice' | 'onUploadPvpAnnex' | 'onComplete'
  > & { canCreate: boolean; canRelease: boolean },
) {
  const item = props.selected;
  if (!item) {
    return (
      <section className={styles.detail}>
        <p>Selecciona un pedido para gestionar su documento.</p>
      </section>
    );
  }

  const isPvp = item.orderType === 'PVP';

  return (
    <section className={styles.detail} aria-labelledby="billing-detail-title">
      <div className={styles.detailHeader}>
        <div>
          <p className="eyebrow">Pedido seleccionado</p>
          <h2 id="billing-detail-title">{item.orderNumber}</h2>
          <p>{item.customerName}</p>
        </div>
        <span className={item.billingReady ? styles.ready : styles.pending}>
          {item.billingReady ? 'Facturación lista' : 'Pendiente'}
        </span>
      </div>

      {isPvp ? (
        <label className={styles.upload}>
          Anexo PVP
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={props.busy || !props.canCreate}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void props.onUploadPvpAnnex(item, file);
            }}
          />
          <small>{item.pvpAnnexCount} anexo(s) registrado(s).</small>
        </label>
      ) : props.canCreate ? (
        <InvoiceForm
          item={item}
          busy={props.busy}
          onSubmit={(input) => props.onRegisterInvoice(item, input)}
        />
      ) : (
        <p className={styles.empty}>Tu perfil tiene acceso de lectura, no de emisión.</p>
      )}

      <div className={styles.summary}>
        <div>
          <span>Factura(s)</span>
          <strong>{item.invoices.length}</strong>
        </div>
        <div>
          <span>Finance</span>
          <strong>{item.financial.decision}</strong>
        </div>
        <div>
          <span>Ruta</span>
          <strong>{item.routeCode.replaceAll('_', ' ')}</strong>
        </div>
      </div>

      <button
        type="button"
        className={styles.release}
        disabled={
          props.busy ||
          !props.canRelease ||
          !item.billingReady ||
          item.financial.decision !== 'APPROVED'
        }
        onClick={() => void props.onComplete(item)}
      >
        Liberar hacia logística
      </button>
    </section>
  );
}

export function BillingWorkspace(props: BillingWorkspaceProps) {
  const canCreate = hasModuleCapability(props.context, 'billing', 'create');
  const canRelease = hasModuleCapability(props.context, 'billing', 'update');

  return (
    <AppShell
      userName={props.context.profile.name}
      organizationName={props.context.organization.name}
      navigation={navigation(props.context)}
      onSignOut={props.onSignOut}
    >
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Tramo final del pedido</p>
            <h1>Facturación</h1>
            <p>
              Documenta la factura o Anexo PVP y libera solo cuando Finance y Orders estén listos.
            </p>
          </div>
        </header>

        {props.message ? (
          <p className={styles.error} role="alert">
            {props.message}
          </p>
        ) : null}
        {props.notice ? (
          <p className={styles.notice} role="status">
            {props.notice}
          </p>
        ) : null}

        <section className={styles.toolbar} aria-label="Filtros de facturación">
          <input
            aria-label="Buscar pedido o cliente"
            placeholder="Pedido o cliente"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
          <button type="button" onClick={props.onSearch} disabled={props.busy}>
            Buscar
          </button>
        </section>

        <div className={styles.layout}>
          <section aria-labelledby="billing-queue-title">
            <h2 id="billing-queue-title">Pendientes</h2>
            <BillingQueueCards
              queue={props.queue}
              selectedId={props.selected?.orderId}
              onSelect={props.onSelect}
            />
          </section>
          <BillingDetail {...props} canCreate={canCreate} canRelease={canRelease} />
        </div>

        {props.busy ? <p role="status">Actualizando facturación…</p> : null}
      </div>
    </AppShell>
  );
}

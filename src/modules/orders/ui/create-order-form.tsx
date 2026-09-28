'use client';

import { useState, type FormEvent } from 'react';
import type { CreateOrderInput } from '@/modules/orders/application/order.schemas';
import { OrderBasicsFields, type CatalogOption } from './order-basics-fields';
import {
  createEmptyOrderItem,
  OrderItemsEditor,
  type DraftOrderItem,
} from './order-items-editor';
import styles from './create-order-form.module.css';

interface CreateOrderFormProps {
  orderTypes: CatalogOption[];
  paymentConditions: CatalogOption[];
  deliveryRoutes: CatalogOption[];
  onCancel(): void;
  onCreate(input: CreateOrderInput): Promise<void>;
}

export function CreateOrderForm(props: CreateOrderFormProps) {
  const [items, setItems] = useState<DraftOrderItem[]>([createEmptyOrderItem()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(null);

    try {
      await props.onCreate({
        orderNumber: String(form.get('orderNumber') ?? ''),
        clientName: String(form.get('clientName') ?? ''),
        clientDocument: String(form.get('clientDocument') ?? '') || undefined,
        clientDepartment: String(form.get('clientDepartment') ?? '') || undefined,
        clientCity: String(form.get('clientCity') ?? ''),
        clientAddress: String(form.get('clientAddress') ?? ''),
        clientPhone: String(form.get('clientPhone') ?? '') || undefined,
        orderType: String(form.get('orderType') ?? ''),
        paymentCondition: String(form.get('paymentCondition') ?? ''),
        deliveryRoute: String(form.get('deliveryRoute') ?? ''),
        requiresPurchase: form.get('requiresPurchase') === 'on',
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          requiresCut: item.requiresCut,
          requestedCutLength: item.requiresCut ? item.requestedCutLength : undefined,
        })),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el pedido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Nuevo pedido</p>
          <h2>Registrar información esencial</h2>
          <p>La prioridad no se captura manualmente; la definirá la inteligencia del cliente.</p>
        </div>
        <button type="button" onClick={props.onCancel} disabled={saving}>Cerrar</button>
      </header>

      <div className={styles.grid}>
        <OrderBasicsFields
          orderTypes={props.orderTypes}
          paymentConditions={props.paymentConditions}
          deliveryRoutes={props.deliveryRoutes}
        />
      </div>

      <OrderItemsEditor items={items} onChange={setItems} />
      {message ? <p className={styles.message} role="alert">{message}</p> : null}

      <footer className={styles.actions}>
        <button type="button" onClick={props.onCancel} disabled={saving}>Cancelar</button>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Creando…' : 'Crear pedido'}
        </button>
      </footer>
    </form>
  );
}

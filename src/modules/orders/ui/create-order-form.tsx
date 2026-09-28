'use client';

import { useState, type FormEvent } from 'react';
import type { CreateOrderInput } from '@/modules/orders/application/order.schemas';
import styles from './create-order-form.module.css';

interface CatalogOption {
  code: string;
  name: string;
}

interface CreateOrderFormProps {
  orderTypes: CatalogOption[];
  paymentConditions: CatalogOption[];
  deliveryRoutes: CatalogOption[];
  onCancel(): void;
  onCreate(input: CreateOrderInput): Promise<void>;
}

interface DraftItem {
  description: string;
  quantity: number;
  requiresCut: boolean;
  requestedCutLength?: number;
}

const emptyItem = (): DraftItem => ({
  description: '',
  quantity: 1,
  requiresCut: false,
});

export function CreateOrderForm({
  orderTypes,
  paymentConditions,
  deliveryRoutes,
  onCancel,
  onCreate,
}: CreateOrderFormProps) {
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(null);

    try {
      await onCreate({
        orderNumber: String(form.get('orderNumber') ?? ''),
        clientName: String(form.get('clientName') ?? ''),
        clientDocument: String(form.get('clientDocument') ?? '') || undefined,
        clientCity: String(form.get('clientCity') ?? ''),
        clientAddress: String(form.get('clientAddress') ?? ''),
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
        <button type="button" onClick={onCancel} disabled={saving}>Cerrar</button>
      </header>

      <div className={styles.grid}>
        <label>
          <span>Número de pedido *</span>
          <input name="orderNumber" required maxLength={120} autoFocus />
        </label>
        <label>
          <span>Cliente *</span>
          <input name="clientName" required maxLength={240} />
        </label>
        <label>
          <span>NIT o documento</span>
          <input name="clientDocument" maxLength={80} />
        </label>
        <label>
          <span>Tipo *</span>
          <select name="orderType" required>
            {orderTypes.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>Condición de pago *</span>
          <select name="paymentCondition" required>
            {paymentConditions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>Modalidad de entrega *</span>
          <select name="deliveryRoute" required>
            {deliveryRoutes.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>Ciudad *</span>
          <input name="clientCity" required maxLength={120} />
        </label>
        <label className={styles.wide}>
          <span>Dirección de entrega *</span>
          <input name="clientAddress" required minLength={5} maxLength={500} />
        </label>
        <label className={styles.check}>
          <input name="requiresPurchase" type="checkbox" />
          <span>Requiere compra o abastecimiento</span>
        </label>
      </div>

      <section className={styles.items} aria-labelledby="items-title">
        <div className={styles.itemsHeader}>
          <div>
            <h3 id="items-title">Materiales</h3>
            <p>Registra cantidades y, cuando aplique, la medida solicitada de corte.</p>
          </div>
          <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])}>
            Agregar material
          </button>
        </div>

        {items.map((item, index) => (
          <fieldset className={styles.item} key={index}>
            <legend>Material {index + 1}</legend>
            <label className={styles.itemDescription}>
              <span>Descripción *</span>
              <input
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.target.value })}
                required
              />
            </label>
            <label>
              <span>Cantidad *</span>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={item.quantity}
                onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                required
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={item.requiresCut}
                onChange={(event) => updateItem(index, { requiresCut: event.target.checked })}
              />
              <span>Requiere corte</span>
            </label>
            {item.requiresCut ? (
              <label>
                <span>Longitud de corte *</span>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={item.requestedCutLength ?? ''}
                  onChange={(event) =>
                    updateItem(index, { requestedCutLength: Number(event.target.value) })
                  }
                  required
                />
              </label>
            ) : null}
            <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}>
              Quitar
            </button>
          </fieldset>
        ))}
      </section>

      {message ? <p className={styles.message} role="alert">{message}</p> : null}

      <footer className={styles.actions}>
        <button type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Creando…' : 'Crear pedido'}
        </button>
      </footer>
    </form>
  );
}

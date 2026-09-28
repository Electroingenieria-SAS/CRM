'use client';

import { useState, type FormEvent } from 'react';
import type { CreateOrderInput } from '@/modules/orders/application/order.schemas';
import styles from './order-create-form.module.css';

interface OrderCreateFormProps {
  busy?: boolean;
  onCancel(): void;
  onSubmit(input: CreateOrderInput): Promise<void>;
}

interface DraftItem {
  description: string;
  quantity: string;
  requiresCut: boolean;
  requestedCutLength: string;
}

const emptyItem = (): DraftItem => ({
  description: '',
  quantity: '1',
  requiresCut: false,
  requestedCutLength: '',
});

export function OrderCreateForm({ busy = false, onCancel, onSubmit }: OrderCreateFormProps) {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderType, setOrderType] = useState('PVC');
  const [paymentCondition, setPaymentCondition] = useState('CASH');
  const [deliveryRoute, setDeliveryRoute] = useState('LOCAL_DISPATCH');
  const [clientName, setClientName] = useState('');
  const [clientDepartment, setClientDepartment] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [message, setMessage] = useState<string | null>(null);

  function patchItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    try {
      await onSubmit({
        orderNumber,
        orderType,
        paymentCondition,
        deliveryRoute,
        clientName,
        clientDepartment: clientDepartment || undefined,
        clientCity,
        clientAddress,
        items: items.map((item, index) => ({
          lineNumber: index + 1,
          description: item.description,
          quantity: Number(item.quantity),
          requiresCut: item.requiresCut,
          requestedCutLength: item.requestedCutLength ? Number(item.requestedCutLength) : undefined,
        })),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el pedido.');
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.grid}>
        <label>
          <span>Número de pedido</span>
          <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required />
        </label>
        <label>
          <span>Tipo</span>
          <select value={orderType} onChange={(event) => setOrderType(event.target.value)}>
            <option value="PVC">PVC</option>
            <option value="PVN">PVN</option>
            <option value="PVE">PVE</option>
            <option value="PVP">PVP</option>
          </select>
        </label>
        <label>
          <span>Condición de pago</span>
          <select value={paymentCondition} onChange={(event) => setPaymentCondition(event.target.value)}>
            <option value="CASH">Contado</option>
            <option value="CREDIT">Crédito</option>
            <option value="MIXED">Mixto</option>
          </select>
        </label>
        <label>
          <span>Entrega</span>
          <select value={deliveryRoute} onChange={(event) => setDeliveryRoute(event.target.value)}>
            <option value="LOCAL_DISPATCH">Despacho local</option>
            <option value="NATIONAL_DISPATCH">Despacho nacional</option>
            <option value="CLIENT_PICKUP">Cliente recoge</option>
            <option value="CLIENT_POINT">Entrega en punto</option>
          </select>
        </label>
        <label className={styles.wide}>
          <span>Cliente</span>
          <input value={clientName} onChange={(event) => setClientName(event.target.value)} required />
        </label>
        <label>
          <span>Departamento</span>
          <input value={clientDepartment} onChange={(event) => setClientDepartment(event.target.value)} />
        </label>
        <label>
          <span>Ciudad</span>
          <input value={clientCity} onChange={(event) => setClientCity(event.target.value)} required />
        </label>
        <label className={styles.wide}>
          <span>Dirección</span>
          <input value={clientAddress} onChange={(event) => setClientAddress(event.target.value)} required />
        </label>
      </div>

      <section className={styles.items} aria-labelledby="items-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className="eyebrow">Detalle</p>
            <h3 id="items-title">Ítems</h3>
          </div>
          <button type="button" className={styles.secondary} onClick={() => setItems((current) => [...current, emptyItem()])}>
            Agregar ítem
          </button>
        </div>

        {items.map((item, index) => (
          <div className={styles.item} key={index}>
            <label className={styles.itemDescription}>
              <span>Descripción</span>
              <input value={item.description} onChange={(event) => patchItem(index, { description: event.target.value })} required />
            </label>
            <label>
              <span>Cantidad</span>
              <input type="number" min="0.0001" step="any" inputMode="decimal" value={item.quantity} onChange={(event) => patchItem(index, { quantity: event.target.value })} required />
            </label>
            <label className={styles.check}>
              <input type="checkbox" checked={item.requiresCut} onChange={(event) => patchItem(index, { requiresCut: event.target.checked })} />
              <span>Requiere corte</span>
            </label>
            {item.requiresCut ? (
              <label>
                <span>Longitud de corte</span>
                <input type="number" min="0.0001" step="any" inputMode="decimal" value={item.requestedCutLength} onChange={(event) => patchItem(index, { requestedCutLength: event.target.value })} required />
              </label>
            ) : null}
            {items.length > 1 ? (
              <button type="button" className={styles.remove} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                Eliminar
              </button>
            ) : null}
          </div>
        ))}
      </section>

      {message ? <p className={styles.error} role="alert">{message}</p> : null}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Crear pedido'}
        </button>
      </div>
    </form>
  );
}

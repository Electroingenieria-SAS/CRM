'use client';

import styles from './create-order-form.module.css';

export interface DraftOrderItem {
  description: string;
  quantity: number;
  requiresCut: boolean;
  requestedCutLength?: number;
}

interface OrderItemsEditorProps {
  items: DraftOrderItem[];
  onChange(items: DraftOrderItem[]): void;
}

export function createEmptyOrderItem(): DraftOrderItem {
  return {
    description: '',
    quantity: 1,
    requiresCut: false,
  };
}

export function OrderItemsEditor({ items, onChange }: OrderItemsEditorProps) {
  function update(index: number, patch: Partial<DraftOrderItem>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    if (items.length === 1) return;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className={styles.items} aria-labelledby="items-title">
      <div className={styles.itemsHeader}>
        <div>
          <h3 id="items-title">Materiales</h3>
          <p>Registra cantidades y, cuando aplique, la medida solicitada de corte.</p>
        </div>
        <button type="button" onClick={() => onChange([...items, createEmptyOrderItem()])}>
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
              onChange={(event) => update(index, { description: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Cantidad *</span>
            <input
              type="number"
              min="0.0001"
              step="any"
              inputMode="decimal"
              value={item.quantity}
              onChange={(event) => update(index, { quantity: Number(event.target.value) })}
              required
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={item.requiresCut}
              onChange={(event) => update(index, { requiresCut: event.target.checked })}
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
                inputMode="decimal"
                value={item.requestedCutLength ?? ''}
                onChange={(event) =>
                  update(index, { requestedCutLength: Number(event.target.value) })
                }
                required
              />
            </label>
          ) : null}
          <button type="button" onClick={() => remove(index)} disabled={items.length === 1}>
            Quitar
          </button>
        </fieldset>
      ))}
    </section>
  );
}

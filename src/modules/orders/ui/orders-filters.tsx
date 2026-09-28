'use client';

import type { FormEvent } from 'react';
import styles from './orders-filters.module.css';

export interface OrdersFilterValues {
  search: string;
  status: string;
  orderType: string;
  route: string;
}

interface OrdersFiltersProps {
  value: OrdersFilterValues;
  onChange(value: OrdersFilterValues): void;
  onSubmit(): void;
}

export function OrdersFilters({ value, onChange, onSubmit }: OrdersFiltersProps) {
  function patch(key: keyof OrdersFilterValues, nextValue: string) {
    onChange({ ...value, [key]: nextValue });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className={styles.filters} onSubmit={submit} role="search">
      <label className={styles.search}>
        <span>Buscar</span>
        <input
          value={value.search}
          onChange={(event) => patch('search', event.target.value)}
          placeholder="Pedido, cliente o referencia"
        />
      </label>
      <label>
        <span>Estado</span>
        <select value={value.status} onChange={(event) => patch('status', event.target.value)}>
          <option value="">Todos</option>
          <option value="QUEUED">En cola</option>
          <option value="ASSIGNED">Asignado</option>
          <option value="IN_PROGRESS">En proceso</option>
          <option value="WAITING">En espera</option>
          <option value="BLOCKED">Bloqueado</option>
          <option value="CLOSED">Cerrado</option>
        </select>
      </label>
      <label>
        <span>Tipo</span>
        <select
          value={value.orderType}
          onChange={(event) => patch('orderType', event.target.value)}
        >
          <option value="">Todos</option>
          <option value="PVC">PVC</option>
          <option value="PVN">PVN</option>
          <option value="PVE">PVE</option>
          <option value="PVP">PVP</option>
        </select>
      </label>
      <label>
        <span>Entrega</span>
        <select value={value.route} onChange={(event) => patch('route', event.target.value)}>
          <option value="">Todas</option>
          <option value="CLIENT_POINT">Punto</option>
          <option value="CLIENT_PICKUP">Recoge</option>
          <option value="LOCAL_DISPATCH">Local</option>
          <option value="NATIONAL_DISPATCH">Nacional</option>
        </select>
      </label>
      <button className="primary-button" type="submit">
        Buscar
      </button>
    </form>
  );
}

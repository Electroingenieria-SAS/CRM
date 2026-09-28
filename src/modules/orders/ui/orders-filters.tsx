'use client';

import type { FormEvent } from 'react';
import styles from './orders-filters.module.css';

export interface OrdersFilterValues {
  search: string;
  status: string;
  orderType: string;
  route: string;
}

export interface OrdersFilterOption {
  code: string;
  name: string;
}

interface OrdersFiltersProps {
  value: OrdersFilterValues;
  orderTypes: OrdersFilterOption[];
  deliveryRoutes: OrdersFilterOption[];
  onChange(value: OrdersFilterValues): void;
  onSubmit(): void;
}

export function OrdersFilters({
  value,
  orderTypes,
  deliveryRoutes,
  onChange,
  onSubmit,
}: OrdersFiltersProps) {
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
          {orderTypes.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Entrega</span>
        <select value={value.route} onChange={(event) => patch('route', event.target.value)}>
          <option value="">Todas</option>
          {deliveryRoutes.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <button className="primary-button" type="submit">
        Buscar
      </button>
    </form>
  );
}

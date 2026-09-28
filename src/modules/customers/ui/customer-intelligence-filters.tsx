'use client';

import styles from './customer-intelligence.module.css';

export interface CustomerIntelligenceFilterValues {
  search: string;
  segment: string;
}

interface Props {
  value: CustomerIntelligenceFilterValues;
  onChange(value: CustomerIntelligenceFilterValues): void;
  onSubmit(): void;
}

export function CustomerIntelligenceFilters({ value, onChange, onSubmit }: Props) {
  return (
    <form
      className={styles.filters}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className={styles.field}>
        Buscar cliente
        <input
          type="search"
          value={value.search}
          placeholder="Nombre o documento"
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        Segmento
        <select
          value={value.segment}
          onChange={(event) => onChange({ ...value, segment: event.target.value })}
        >
          <option value="">Todos</option>
          <option value="URGENT">Urgente</option>
          <option value="PREMIUM">Premium</option>
          <option value="NORMAL">Normal</option>
          <option value="BASIC">Básico</option>
        </select>
      </label>
      <button className="primary-button" type="submit">
        Aplicar filtros
      </button>
    </form>
  );
}

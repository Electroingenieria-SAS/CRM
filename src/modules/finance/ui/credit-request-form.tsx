'use client';

import { useState } from 'react';
import type { FinanceCustomerSearch } from '@/modules/finance/application/finance.schemas';
import styles from './finance-ui.module.css';

interface CreditRequestFormProps {
  customers: FinanceCustomerSearch['items'];
  searching: boolean;
  onSearch(search: string): Promise<void>;
  onSubmit(input: {
    customerId: string;
    requestedAmount: number;
    requestedTermDays: number;
  }): Promise<void>;
}

export function CreditRequestForm(props: CreditRequestFormProps) {
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('30');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerId) return;
    await props.onSubmit({
      customerId,
      requestedAmount: Number(amount),
      requestedTermDays: Number(term),
    });
    setAmount('');
  }

  return (
    <section className={styles.section} aria-labelledby="credit-new-title">
      <h2 id="credit-new-title">Radicar solicitud</h2>
      <p>El valor y plazo corresponden a la solicitud real; no crean un cupo reutilizable.</p>
      <div className={styles.toolbar}>
        <div className={styles.field}>
          <label htmlFor="credit-customer-search">Buscar cliente</label>
          <input
            id="credit-customer-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o documento"
          />
        </div>
        <button type="button" onClick={() => void props.onSearch(search)} disabled={props.searching}>
          {props.searching ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label htmlFor="credit-customer">Cliente</label>
            <select
              id="credit-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              required
            >
              <option value="">Selecciona un cliente</option>
              {props.customers.map((customer) => (
                <option value={customer.id} key={customer.id}>
                  {customer.name} {customer.document ? '· ' + customer.document : ''}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="credit-amount">Valor solicitado (COP)</label>
            <input
              id="credit-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="credit-term">Plazo solicitado (días)</label>
            <input
              id="credit-term"
              type="number"
              min="1"
              step="1"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              required
            />
          </div>
        </div>
        <div className={styles.actions}>
          <button className="primary-button" type="submit" disabled={!customerId || !amount}>
            Radicar crédito
          </button>
        </div>
      </form>
    </section>
  );
}

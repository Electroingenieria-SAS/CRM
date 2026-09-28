'use client';

import { useState, type FormEvent } from 'react';
import styles from './login-form.module.css';

interface LoginFormProps {
  disabled?: boolean;
  onLogin(email: string, password: string): Promise<void>;
  onRecover(email: string): Promise<void>;
}

export function LoginForm({ disabled = false, onLogin, onRecover }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'recovering'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState('loading');
    setMessage(null);
    try {
      await onLogin(email, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible iniciar sesión.');
      setState('idle');
    }
  }

  async function recover() {
    setState('recovering');
    setMessage(null);
    try {
      await onRecover(email);
      setMessage('Si el correo está registrado, recibirás las instrucciones de recuperación.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No fue posible solicitar la recuperación.',
      );
    } finally {
      setState('idle');
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label htmlFor="login-email">Correo</label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={disabled || state !== 'idle'}
          required
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Contraseña</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={disabled || state !== 'idle'}
          required
        />
      </div>

      {message ? (
        <p className={styles.message} role="status">
          {message}
        </p>
      ) : null}

      <button className="primary-button" type="submit" disabled={disabled || state !== 'idle'}>
        {state === 'loading' ? 'Ingresando…' : 'Ingresar'}
      </button>
      <button
        className={styles.recovery}
        type="button"
        onClick={recover}
        disabled={disabled || state !== 'idle' || !email.trim()}
      >
        {state === 'recovering' ? 'Solicitando…' : 'Olvidé mi contraseña'}
      </button>
    </form>
  );
}

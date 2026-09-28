'use client';

import { useState, type FormEvent } from 'react';

interface PasswordUpdateFormProps {
  disabled?: boolean;
  onUpdate(password: string): Promise<void>;
}

export function PasswordUpdateForm({ disabled = false, onUpdate }: PasswordUpdateFormProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onUpdate(password);
      setMessage('Contraseña actualizada correctamente.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack-form">
      <label>
        <span>Nueva contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={disabled || saving}
          required
        />
      </label>
      <label>
        <span>Confirmar contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={disabled || saving}
          required
        />
      </label>
      {message ? <p role="status">{message}</p> : null}
      <button className="primary-button" type="submit" disabled={disabled || saving}>
        {saving ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

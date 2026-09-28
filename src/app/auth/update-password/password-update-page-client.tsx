'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserApplication } from '@/composition/browser-application';
import { PasswordUpdateForm } from '@/modules/auth/ui/password-update-form';

type RecoveryState = 'checking' | 'ready' | 'error';

export function PasswordUpdatePageClient() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [state, setState] = useState<RecoveryState>('checking');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!application) return;

    let active = true;
    const params = new URLSearchParams(window.location.search);

    void application.auth
      .preparePasswordRecovery({
        code: params.get('code'),
        flowId: params.get('sb_flow_id'),
      })
      .then(() => {
        if (!active) return;
        window.history.replaceState({}, '', window.location.pathname);
        setState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setState('error');
        setMessage(
          error instanceof Error
            ? error.message
            : 'El enlace de recuperación no es válido o ya expiró.',
        );
      });

    return () => {
      active = false;
    };
  }, [application]);

  if (!application) {
    return (
      <main id="main-content" className="centered-page">
        <section className="surface" aria-labelledby="password-title">
          <p className="eyebrow">Seguridad</p>
          <h1 id="password-title">Cambiar contraseña</h1>
          <p role="alert">Este entorno no tiene un backend de autenticación configurado.</p>
          <Link href="/login">Volver al inicio de sesión</Link>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="centered-page">
      <section className="surface" aria-labelledby="password-title">
        <p className="eyebrow">Seguridad</p>
        <h1 id="password-title">Cambiar contraseña</h1>
        <p>Utiliza una contraseña de al menos 12 caracteres y evita reutilizar credenciales.</p>

        {state === 'checking' ? <p role="status">Validando enlace de recuperación…</p> : null}

        {state === 'error' ? (
          <>
            <p role="alert">{message}</p>
            <Link href="/login">Volver al inicio de sesión</Link>
          </>
        ) : null}

        {state === 'ready' ? (
          <PasswordUpdateForm
            onUpdate={async (password) => {
              await application.auth.updatePassword({ password });
              await application.auth.signOut();
              router.replace('/login?passwordUpdated=1');
            }}
          />
        ) : null}
      </section>
    </main>
  );
}

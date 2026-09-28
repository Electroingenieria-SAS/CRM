'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserApplication } from '@/composition/browser-application';
import { LoginForm } from '@/modules/auth/ui/login-form';

function recoveryRedirect(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URL('../auth/update-password/', window.location.href).toString();
}

function passwordUpdatedNotice(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('passwordUpdated') === '1'
    ? 'Tu contraseña fue actualizada. Inicia sesión con la nueva contraseña.'
    : null;
}

export function LoginPageClient() {
  const router = useRouter();
  const application = useMemo(() => createBrowserApplication(), []);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setNotice(passwordUpdatedNotice());
    if (!application) return;

    let active = true;
    void application.auth
      .restoreContext()
      .then((context) => {
        if (active && context) router.replace('/orders');
      })
      .catch((error) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : 'No fue posible restaurar la sesión.');
        }
      });

    return () => {
      active = false;
    };
  }, [application, router]);

  return (
    <main id="main-content" className="centered-page">
      <section className="surface" aria-labelledby="login-title">
        <p className="eyebrow">Electroingeniería S.A.S.</p>
        <h1 id="login-title">Ingresar al CRM</h1>
        <p>
          Usa tu cuenta asignada. El acceso a cada módulo se valida nuevamente en la base de datos.
        </p>
        {!application ? (
          <p role="status">
            Este staging visual no está conectado a un backend operativo. La integración se valida
            en CI contra un Supabase aislado.
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        <LoginForm
          disabled={!application}
          onLogin={async (email, password) => {
            if (!application) return;
            await application.auth.signIn({ email, password });
            router.replace('/orders');
          }}
          onRecover={async (email) => {
            if (!application) return;
            await application.auth.requestPasswordReset({ email }, recoveryRedirect());
          }}
        />
      </section>
    </main>
  );
}

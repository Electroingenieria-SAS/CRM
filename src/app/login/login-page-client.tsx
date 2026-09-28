'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { LoginForm } from '@/modules/auth/ui/login-form';

function recoveryRedirect(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URL('../auth/update-password/', window.location.href).toString();
}

export function LoginPageClient() {
  const router = useRouter();
  const gateway = useMemo(() => {
    const client = createSupabaseBrowserClient();
    return client ? new SupabaseAuthGateway(client) : null;
  }, []);

  return (
    <main id="main-content" className="centered-page">
      <section className="surface" aria-labelledby="login-title">
        <p className="eyebrow">Electroingeniería S.A.S.</p>
        <h1 id="login-title">Ingresar al CRM</h1>
        <p>
          Usa tu cuenta asignada. El acceso a cada módulo se valida nuevamente en la base de datos.
        </p>
        {!gateway ? (
          <p role="status">
            Este staging visual no está conectado a un backend operativo. La integración se valida
            en CI contra un Supabase aislado.
          </p>
        ) : null}
        <LoginForm
          disabled={!gateway}
          onLogin={async (email, password) => {
            if (!gateway) return;
            await gateway.signIn({ email, password });
            router.replace('/orders');
          }}
          onRecover={async (email) => {
            if (!gateway) return;
            await gateway.requestPasswordReset({ email }, recoveryRedirect());
          }}
        />
      </section>
    </main>
  );
}

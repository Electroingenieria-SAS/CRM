'use client';

import { useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/infrastructure/supabase/browser-client';
import { SupabaseAuthGateway } from '@/infrastructure/auth/supabase-auth-gateway';
import { PasswordUpdateForm } from '@/modules/auth/ui/password-update-form';

export function PasswordUpdatePageClient() {
  const gateway = useMemo(() => {
    const client = createSupabaseBrowserClient();
    return client ? new SupabaseAuthGateway(client) : null;
  }, []);

  return (
    <main id="main-content" className="centered-page">
      <section className="surface" aria-labelledby="password-title">
        <p className="eyebrow">Seguridad</p>
        <h1 id="password-title">Cambiar contraseña</h1>
        <p>Utiliza una contraseña de al menos 12 caracteres y evita reutilizar credenciales.</p>
        <PasswordUpdateForm
          disabled={!gateway}
          onUpdate={async (password) => {
            if (!gateway) return;
            await gateway.updatePassword({ password });
          }}
        />
      </section>
    </main>
  );
}

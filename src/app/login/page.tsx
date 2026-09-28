import { Suspense } from 'react';
import { LoginPageClient } from '@/app/login/login-page-client';

function LoginFallback() {
  return (
    <main id="main-content" className="centered-page">
      <section className="surface" aria-live="polite">
        <p className="eyebrow">Electroingeniería S.A.S.</p>
        <h1>Preparando inicio de sesión…</h1>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}

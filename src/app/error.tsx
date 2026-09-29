'use client';

import { useEffect } from 'react';
import { logStructured } from '@/shared/observability/logger';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logStructured({
      level: 'error',
      event: 'app_boundary_error',
      module: 'app',
      context: { message: error.message, digest: error.digest },
    });
  }, [error]);

  return (
    <main id="main-content" className="centered-page">
      <section className="surface" role="alert" aria-labelledby="error-title">
        <p className="eyebrow">Estado controlado</p>
        <h1 id="error-title">No fue posible cargar esta vista</h1>
        <p>La aplicación conservó un estado seguro. Puedes volver a intentarlo sin perder la sesión.</p>
        <button className="primary-button" type="button" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}

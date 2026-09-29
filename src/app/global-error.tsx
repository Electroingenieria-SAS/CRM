'use client';

import { useEffect } from 'react';
import { logStructured } from '@/shared/observability/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logStructured({
      level: 'error',
      event: 'global_boundary_error',
      module: 'app',
      context: { message: error.message, digest: error.digest },
    });
  }, [error]);

  return (
    <html lang="es">
      <body>
        <main className="centered-page">
          <section className="surface" role="alert">
            <h1>CRM temporalmente no disponible</h1>
            <p>La aplicación protegió la sesión y no guardó información sensible en este error.</p>
            <button type="button" onClick={reset}>Reintentar</button>
          </section>
        </main>
      </body>
    </html>
  );
}

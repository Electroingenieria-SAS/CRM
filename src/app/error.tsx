'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="centered-page">
      <section className="surface" role="alert" aria-labelledby="error-title">
        <p className="eyebrow">Estado controlado</p>
        <h1 id="error-title">No fue posible cargar esta vista</h1>
        <p>La aplicación conservó un estado seguro. Puedes volver a intentarlo.</p>
        <button className="primary-button" type="button" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}

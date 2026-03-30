interface RegistrationPageProps {
  onBackToLogin: () => void;
}

/** Public registration page. Stub — renders a placeholder form. */
export function RegistrationPage({ onBackToLogin }: RegistrationPageProps) {
  return (
    <main className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <section className="panel" style={{ maxWidth: 500, width: "100%", padding: "2rem" }}>
        <p className="eyebrow">Cars Control</p>
        <h1>Registro de empresa</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>Formulario de registro en construccion.</p>
        <button type="button" className="button secondary" onClick={onBackToLogin}>
          Volver al login
        </button>
      </section>
    </main>
  );
}

interface PlatformLayoutProps {
  userId: number;
  userName: string;
  onBackToCompany: () => void;
}

/** Platform super-admin layout shell. Stub — renders children placeholder. */
export function PlatformLayout({ userName, onBackToCompany }: PlatformLayoutProps) {
  return (
    <main className="shell">
      <section className="panel" style={{ padding: "2rem" }}>
        <p className="eyebrow">Panel de Plataforma</p>
        <h1>Bienvenido, {userName}</h1>
        <p className="muted">Panel de administracion de la plataforma.</p>
        <button type="button" className="button secondary" onClick={onBackToCompany} style={{ marginTop: "1rem" }}>
          Volver a la empresa
        </button>
      </section>
    </main>
  );
}

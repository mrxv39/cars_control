import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.4rem" }}>Algo ha ido mal</h2>
          <p style={{ color: "#64748b", margin: "0 0 1.25rem" }}>
            Ha ocurrido un error inesperado. Recarga la pagina para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "12px",
              border: "none",
              background: "#1d4ed8",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

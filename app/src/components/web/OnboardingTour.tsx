import { useState, useEffect } from "react";

interface TourStep {
  target: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  { target: "nav", title: "Navegación", description: "Aquí están todas las secciones: stock, leads, ventas, compras..." },
  { target: "dashboard", title: "Dashboard", description: "Vista general con las métricas de tu negocio: stock, leads activos y ventas." },
  { target: "stock", title: "Stock", description: "Gestiona tus vehículos: fotos, precios, estado y documentación." },
  { target: "leads", title: "Leads", description: "Controla los contactos interesados. Convierte leads en clientes cuando compren." },
  { target: "feedback-fab", title: "Sugerencias", description: "Pulsa aquí para ver consejos según la pantalla en la que estés." },
];

const STORAGE_KEY = "cc_onboarding_done";

interface OnboardingTourProps {
  show: boolean;
  onClose?: () => void;
}

export default function OnboardingTour({ show, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    setVisible(true);
    setStep(0);
  }, [show]);

  function dismiss() {
    setVisible(false);
    onClose?.();
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  }

  function next() {
    if (step >= STEPS.length - 1) { dismiss(); return; }
    setStep(step + 1);
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Tutorial de inicio">
      <div className="onboarding-card panel">
        <div className="onboarding-step-indicator">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} />
          ))}
        </div>
        <h3 className="onboarding-title">{current.title}</h3>
        <p className="onboarding-desc">{current.description}</p>
        <div className="onboarding-actions">
          <button type="button" className="button secondary" onClick={dismiss} style={{ fontSize: "0.82rem" }}>
            Saltar
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {step > 0 && (
              <button type="button" className="button secondary" onClick={prev} style={{ fontSize: "0.82rem" }}>
                Anterior
              </button>
            )}
            <button type="button" className="button primary" onClick={next} style={{ fontSize: "0.82rem" }}>
              {step === STEPS.length - 1 ? "Empezar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetOnboarding() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

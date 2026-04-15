import { useEffect, useState } from "react";

interface UndoToastProps {
  message: string;
  duration?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoToast({ message, duration = 6000, onUndo, onDismiss }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 100) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return r - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  const pct = (remaining / duration) * 100;

  return (
    <div className="undo-toast" role="alert">
      <span>{message}</span>
      <button type="button" className="undo-toast-btn" onClick={onUndo}>
        Deshacer
      </button>
      <button type="button" className="undo-toast-close" onClick={onDismiss} aria-label="Cerrar">
        ✕
      </button>
      <div className="undo-toast-progress" style={{ width: `${pct}%` }} />
    </div>
  );
}

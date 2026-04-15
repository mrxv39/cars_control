import { useRef, useCallback } from "react";

/**
 * Tracks whether a form has been modified since opening.
 * Returns a `guardFn` that wraps the modal close callback
 * and shows a confirmation if the form is dirty.
 */
export function useDirtyForm() {
  const dirty = useRef(false);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  const reset = useCallback(() => {
    dirty.current = false;
  }, []);

  const guardClose = useCallback(
    (onClose: () => void) => {
      if (!dirty.current) { onClose(); return; }
      if (window.confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) {
        dirty.current = false;
        onClose();
      }
    },
    []
  );

  return { markDirty, reset, guardClose, isDirty: () => dirty.current };
}

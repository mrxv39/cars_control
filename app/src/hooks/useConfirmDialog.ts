import { useState, useCallback, useRef } from "react";

export function useConfirmDialog() {
  const [state, setState] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: "", message: "", onConfirm: () => {} });
  const onConfirmRef = useRef(state.onConfirm);
  onConfirmRef.current = state.onConfirm;
  const requestConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setState({ open: true, title, message, onConfirm });
  }, []);
  const cancel = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const confirm = useCallback(() => { onConfirmRef.current(); setState((s) => ({ ...s, open: false })); }, []);
  return { confirmProps: { open: state.open, title: state.title, message: state.message, onConfirm: confirm, onCancel: cancel }, requestConfirm };
}

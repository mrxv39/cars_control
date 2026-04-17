/** Minimal pub/sub toast system — import showToast() from any component */
export type ToastType = "success" | "error";
type Listener = (message: string, type: ToastType) => void;

let listener: Listener | null = null;

/** Subscribe to toast events. Returns unsubscribe function. */
export function onToast(fn: Listener): () => void {
  listener = fn;
  return () => { listener = null; };
}

/** Show a toast from any component. Requires ToastContainer mounted in the tree. */
export function showToast(message: string, type: ToastType = "success"): void {
  listener?.(message, type);
}

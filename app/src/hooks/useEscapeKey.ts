import { useEffect } from "react";

export function useEscapeKey(active: boolean, callback: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") callback(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, callback]);
}

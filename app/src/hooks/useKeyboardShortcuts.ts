import { useEffect } from "react";

interface ShortcutMap {
  [key: string]: () => void;
}

/**
 * Registers global keyboard shortcuts.
 * Ignores keystrokes when an input, textarea, or select is focused.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      const fn = shortcuts[key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

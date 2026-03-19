import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppStatePayload } from "../types";

export function useAppState() {
  const [appState, setAppState] = useState<AppStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadState() {
    setLoading(true);
    setError(null);
    try {
      setAppState(await invoke<AppStatePayload>("load_app_state"));
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadState();
  }, []);

  return { appState, setAppState, loading, error, loadState };
}

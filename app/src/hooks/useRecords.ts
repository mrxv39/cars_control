import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useRecords<T>(command: string) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<T[]>(command);
      setRecords(data);
    } catch (err) {
      console.error(`Error loading ${command}:`, err);
    } finally {
      setLoading(false);
    }
  }, [command]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { records, setRecords, loading, reload };
}

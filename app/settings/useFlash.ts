import { useState, useCallback } from "react";

export function useFlash() {
  const [saved, setSaved] = useState<string | null>(null);

  const flash = useCallback((message: string = "Сохранено ✓", timeout: number = 2500) => {
    setSaved(message);
    setTimeout(() => setSaved(null), timeout);
  }, []);

  return { saved, flash, setSaved };
}

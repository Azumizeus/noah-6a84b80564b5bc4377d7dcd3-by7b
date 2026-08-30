// src/hooks/useViewMode.ts
import { useCallback, useState } from 'react';
import { loadViewMode, saveViewMode, type ViewMode } from '../lib/viewMode';

export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(() => loadViewMode());
  const setMode = useCallback((v: ViewMode) => {
    setModeState(v);
    saveViewMode(v);
  }, []);
  return [mode, setMode];
}

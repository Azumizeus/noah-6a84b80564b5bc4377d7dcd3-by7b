// src/hooks/useDensity.ts
import { useCallback, useState } from 'react';
import { loadDensity, saveDensity, type Density } from '../lib/density';

export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>(() => loadDensity());
  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    saveDensity(d);
  }, []);
  return [density, setDensity];
}

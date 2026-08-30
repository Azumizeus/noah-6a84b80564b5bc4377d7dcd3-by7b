// src/hooks/useProjectCreatedAt.ts
import { useEffect, useState } from 'react';
import { fetchProjectCreatedAtMap } from '../lib/projectCreatedAt';

export function useProjectCreatedAt() {
  const [createdAt, setCreatedAt] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetchProjectCreatedAtMap().then((m) => {
      if (!cancelled) setCreatedAt(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return createdAt;
}

export default useProjectCreatedAt;

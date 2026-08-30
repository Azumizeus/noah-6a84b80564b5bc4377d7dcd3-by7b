// src/hooks/useSectionOrder.ts
// ═══════════════════════════════════════════════════════════════════
// Réordonnancement de sections d'une page — générique, persisté par
// wallet (comme le thème) : `pageKey` distingue la page (ex. "profile"),
// `wallet` distingue l'utilisateur. `null` wallet → pas de scope
// (préférence de navigateur, comme la densité d'affichage).
//
// Persiste un TABLEAU d'IDs, pas un objet — l'ordre EST la donnée. Si
// `defaultOrder` change entre deux versions de l'app (section ajoutée/
// retirée), on filtre l'ordre stocké aux clés encore valides et on
// ajoute les nouvelles à la fin, plutôt que de planter ou d'en perdre.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useState } from 'react';

function storageKey(pageKey: string, wallet: string | null): string {
  return wallet ? `buildpact_section_order_${pageKey}_${wallet}` : `buildpact_section_order_${pageKey}`;
}

function loadOrder<K extends string>(pageKey: string, wallet: string | null, defaultOrder: readonly K[]): K[] {
  try {
    const raw = localStorage.getItem(storageKey(pageKey, wallet));
    if (!raw) return [...defaultOrder];
    const parsed = JSON.parse(raw) as string[];
    const known = new Set(defaultOrder as readonly string[]);
    const kept = parsed.filter((k): k is K => known.has(k));
    const missing = defaultOrder.filter((k) => !kept.includes(k));
    return [...kept, ...missing];
  } catch {
    return [...defaultOrder];
  }
}

function saveOrder(pageKey: string, wallet: string | null, order: string[]): void {
  try {
    localStorage.setItem(storageKey(pageKey, wallet), JSON.stringify(order));
  } catch {
    /* non bloquant */
  }
}

export function useSectionOrder<K extends string>(
  pageKey: string,
  wallet: string | null,
  defaultOrder: readonly K[]
): {
  order: K[];
  moveUp: (key: K) => void;
  moveDown: (key: K) => void;
  isFirst: (key: K) => boolean;
  isLast: (key: K) => boolean;
} {
  const [order, setOrder] = useState<K[]>(() => loadOrder(pageKey, wallet, defaultOrder));

  const move = useCallback(
    (key: K, dir: -1 | 1) => {
      setOrder((prev) => {
        const idx = prev.indexOf(key);
        const swapWith = idx + dir;
        if (idx < 0 || swapWith < 0 || swapWith >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        saveOrder(pageKey, wallet, next);
        return next;
      });
    },
    [pageKey, wallet]
  );

  return useMemo(
    () => ({
      order,
      moveUp: (key: K) => move(key, -1),
      moveDown: (key: K) => move(key, 1),
      isFirst: (key: K) => order.indexOf(key) === 0,
      isLast: (key: K) => order.indexOf(key) === order.length - 1,
    }),
    [order, move]
  );
}

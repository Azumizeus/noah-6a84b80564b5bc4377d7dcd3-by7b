// src/lib/usdDisplay.ts
// Réglage "Afficher l'équivalent USD" — préférence de navigateur (comme
// densité/RPC personnalisé), pas d'identité, pas de scope par wallet.
const KEY = 'buildpact_show_usd';

export function loadShowUsd(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShowUsd(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* non bloquant */
  }
}

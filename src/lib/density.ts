// src/lib/density.ts
// ═══════════════════════════════════════════════════════════════════
// Densité d'affichage des listes de pacts — préférence de navigateur
// (comme glowStrength/previewEnabled dans ThemeContext), pas d'identité :
// aucun scope par wallet, un seul localStorage global.
// ═══════════════════════════════════════════════════════════════════
export type Density = 'comfortable' | 'compact';

const KEY = 'buildpact_density';
export const DEFAULT_DENSITY: Density = 'comfortable';

export function isDensity(value: unknown): value is Density {
  return value === 'comfortable' || value === 'compact';
}

export function loadDensity(): Density {
  try {
    const raw = localStorage.getItem(KEY);
    return isDensity(raw) ? raw : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function saveDensity(d: Density): void {
  try {
    localStorage.setItem(KEY, d);
  } catch {
    /* non bloquant */
  }
}

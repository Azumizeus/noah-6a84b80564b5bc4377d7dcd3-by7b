// src/lib/viewMode.ts
// ═══════════════════════════════════════════════════════════════════
// Mode d'affichage des listes de pacts (30/08, demande explicite déjà
// faite plusieurs fois) — liste détaillée / grille / petites vignettes.
// Même convention que density.ts : préférence de navigateur, pas
// d'identité (pas de scope par wallet), un seul localStorage global.
// Partagé entre Pacts et Marketplace pour un comportement cohérent —
// changer le mode sur l'un le change aussi sur l'autre (préférence de
// lecture, pas une config par page).
// ═══════════════════════════════════════════════════════════════════
export type ViewMode = 'list' | 'grid' | 'compact';

const KEY = 'buildpact_view_mode';
export const DEFAULT_VIEW_MODE: ViewMode = 'list';

export function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'grid' || value === 'compact';
}

export function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(KEY);
    return isViewMode(raw) ? raw : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function saveViewMode(v: ViewMode): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* non bloquant */
  }
}

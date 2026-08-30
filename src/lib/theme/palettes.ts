// src/lib/theme/palettes.ts
// ═══════════════════════════════════════════════════════════════════
// Définit les palettes de couleur disponibles pour l'app. Module pur
// (aucun import React) volontairement séparé du contexte de thème pour
// que src/lib/profile.ts puisse importer le type Palette sans tirer tout
// le contexte React dans un simple fichier de types.
//
// ⚠️ --accent-neon (vert) N'EST JAMAIS réécrit par une palette (voir
// index.css) : il porte un sens fixe dans toute l'app — mouvement de fonds
// (fund/distribute/claim, voir .btn-neon dans index.css) — et changer sa
// teinte casserait ce repère visuel appris par l'utilisateur. Seuls les
// rôles "violet" (accent principal) et "gold" (accent secondaire) varient
// d'une palette à l'autre.
//
// ⚠️ Cette liste est DUPLIQUÉE dans supabase/functions/update-profile
// (const THEME_PALETTES). Une valeur absente de la liste côté serveur n'est
// pas rejetée : elle est écrasée en NULL, et l'appel répond quand même
// { ok: true }. Ajouter une palette ici SANS redéployer la fonction produit
// donc une perte silencieuse en base.
// ═══════════════════════════════════════════════════════════════════

export type Palette = 'violet' | 'cyan' | 'coral' | 'aurum' | 'atelier';

// 29/08 (soir) : + aurum (noir chaud + or) et atelier (ivoire + encre, seul
// mode clair distinctif du lot). Voir index.css pour les blocs [data-theme].
export const PALETTES: Palette[] = ['violet', 'cyan', 'coral', 'aurum', 'atelier'];

export function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTES as string[]).includes(value);
}

/** Couleur de prévisualisation (le rôle "violet", le plus utilisé dans l'UI)
 *  pour chaque palette — sert aux pastilles du sélecteur, en JS pur (pas de
 *  lecture de variable CSS nécessaire pour peindre un petit rond). */
export const PALETTE_SWATCH: Record<Palette, string> = {
  violet: '#9945FF',
  cyan: '#22D3EE',
  coral: '#FB7185',
  aurum: '#E8B84B',
  atelier: '#1A1814',
};

export const PALETTE_LABEL_KEY: Record<Palette, string> = {
  violet: 'theme.violet',
  cyan: 'theme.cyan',
  coral: 'theme.coral',
  aurum: 'theme.aurum',
  atelier: 'theme.atelier',
};

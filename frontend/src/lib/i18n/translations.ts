// src/lib/i18n/translations.ts
// ═══════════════════════════════════════════════════════════════════
// Dictionnaire FR/EN — tout le texte de l'app passe par t('namespace.key').
// Structure : objets imbriqués par page/composant, valeurs = string (avec
// {{placeholders}} optionnels remplacés via des params). Pas de librairie
// externe : app légère, pas de build step supplémentaire à gérer avant le
// hackathon.
//
// Les dictionnaires vivent dans ./fr.ts et ./en.ts (un fichier monolithique
// devenait ingérable) — ce module ne garde que le résolveur t().
// ═══════════════════════════════════════════════════════════════════
import { fr } from './fr';
import { en } from './en';
import type { Dict, Lang } from './types';

export type { Lang, Dict };

/** Dictionnaires par langue — exporté pour les sélecteurs de langue / tests. */
export const translations: Record<Lang, Dict> = { fr, en };

const DICTS = translations;

// ⚠️ Segments interdits : `node[part]` traverse un objet avec une chaîne
// arbitraire. Sans ce garde, t('__proto__.toString') remonterait une
// fonction héritée du prototype au lieu d'une traduction — et la même
// mécanique, appliquée à une écriture, permettrait de polluer Object.
// Ici on ne fait que lire, donc le risque réel est faible ; le garde reste
// parce qu'il coûte une ligne et supprime toute ambiguïté.
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** Résout une clé "a.b.c" dans un dictionnaire imbriqué. */
function resolve(dict: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let node: string | Dict | undefined = dict;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    if (FORBIDDEN_SEGMENTS.has(part)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(node, part)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Remplace les {{placeholders}} par les valeurs fournies. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/**
 * Traduit une clé dans la langue demandée.
 * Fallback : FR si la clé manque en EN, puis la clé brute (visible en dev,
 * jamais un écran vide en démo).
 */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  const value = resolve(DICTS[lang], key) ?? resolve(DICTS.fr, key);
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${key}`);
    return key;
  }
  return interpolate(value, params);
}

export { fr, en };

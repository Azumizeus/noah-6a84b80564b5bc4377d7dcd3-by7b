// src/components/QuestIcons.tsx
// ═══════════════════════════════════════════════════════════════════
// Icônes SVG custom pour le journal de quêtes/chronique.
//
// Passe "Duolingo" (30/08, sur référence explicite de l'utilisateur, voir
// buildpact_hd_backgrounds_integrated_300826.md) — silhouettes redessinées
// plus rondes, plus épaisses, plus "amicales" (coins arrondis partout,
// trait épais et régulier, formes pleines plutôt que fines lignes) : le
// même principe de construction que les icônes Duolingo (ex. la flamme de
// streak, le badge de complétion), sans copier leur mascotte ni leur
// palette — BuildPact garde sa propre identité (violet/or/néon).
//
// ⚠️ Contrainte qui n'a PAS changé et qui dicte tout le reste : ces icônes
// restent `currentColor`, jamais de couleur figée dans le glyphe. Dans
// QuestBoard.tsx la couleur encode l'ÉTAT de la quête (gris = à faire,
// or = prête à réclamer, néon = réclamée) — un glyphe multicolore casserait
// ce système. Duolingo peut se permettre des icônes en couleur fixe parce
// que chez eux la couleur encode l'IDENTITÉ de l'icône, pas un état ; ici
// c'est l'inverse, donc on emprunte la GRAMMAIRE DE FORME (rond, épais,
// plein) sans emprunter la grammaire de couleur.
// ═══════════════════════════════════════════════════════════════════
import type { FC } from 'react';

interface IconProps {
  className?: string;
}

const BASE = 'h-3.5 w-3.5 shrink-0';

export function IconFund({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M10 6.2v7.6M7.6 8.1c0-1.1 1-1.9 2.4-1.9s2.4.7 2.4 1.6c0 2.1-4.8 1-4.8 3.1 0 1 1 1.8 2.4 1.8s2.4-.8 2.4-1.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Reflet — un simple arc plus fin en haut à gauche, comme le lustre
          plat qu'ont les gemmes/pièces Duolingo pour suggérer du volume
          sans sortir du monochrome (stroke-opacity, pas une 2e couleur). */}
      <path d="M5.3 6.6a6.3 6.3 0 0 1 2.4-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.45" />
    </svg>
  );
}

export function IconApprove({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="7.3" stroke="currentColor" strokeWidth="2.2" />
      <path d="M6.3 10.3l2.6 2.6L14 7.4" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFinalize({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M4.6 2.8v14.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path
        d="M4.6 4h9.1c1 0 1.4.9.8 1.6L12.6 8l1.9 2.4c.6.7.2 1.6-.8 1.6H4.6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Damier du fanion — deux blocs pleins en plus faible opacité,
          suggèrent le motif "ligne d'arrivée" sans dessiner une vraie
          grille (illisible à 14px). */}
      <path d="M8.4 5.6h2v1.9h-2zM10.4 7.9h2v1.9h-2z" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

export function IconCreate({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M10 17v-7.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path
        d="M10 9.4C10 5.6 7.2 3.4 4 3.4c0 3.5 2.6 6 6 6ZM10 9.4c0-3.5 2.4-6.3 5.7-6.3-.3 3.5-2.9 6.3-5.7 6.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconDistribute({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="2.8" y="8.6" width="14.4" height="8.2" rx="2.4" stroke="currentColor" strokeWidth="2" />
      <path d="M2.8 8.6h14.4M10 8.6v8.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M6.7 8.6c-1.6 0-2.9-1.1-2.9-2.5S5.1 3.6 6.7 3.6c2 0 3.9 2.2 3.9 5-2.1 0-3.9 0-3.9 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M13.3 8.6c1.6 0 2.9-1.1 2.9-2.5s-1.3-2.5-2.9-2.5c-2 0-3.9 2.2-3.9 5 2.1 0 3.9 0 3.9 0Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconAddMember({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <circle cx="7.8" cy="6.9" r="3.1" stroke="currentColor" strokeWidth="1.9" />
      <path d="M2.2 17c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.7 5.7v5.2M13.1 8.3h5.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconStreak({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 2.3c1.6 2.6-1 3.6-1 6.1 0 1.1.9 1.9 1.9 1.9 1.4 0 2.3-1.1 2.3-2.7 2.1 1.7 3.2 3.9 3.2 5.9 0 3.4-2.9 6-6.4 6s-6.4-2.6-6.4-6c0-3.7 2.6-6.8 6.4-11.2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Flamme intérieure, remplie en faible opacité — donne le volume à
          deux tons que Duolingo obtient par une 2e couleur, ici simulé en
          restant monochrome (fill-opacity, pas de nouvelle couleur). */}
      <path
        d="M10.2 8.6c.5 1-.6 1.7-.6 3 0 1.2 1 2.1 2.2 2.1s2.2-1 2.2-2.2c0-.7-.3-1.4-.8-2 .1 1.1-.6 1.8-1.5 1.8-1 0-1.5-.7-1.5-2.7Z"
        fill="currentColor"
        fillOpacity="0.55"
      />
    </svg>
  );
}

export function IconBonus({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect x="2.8" y="8" width="14.4" height="9.2" rx="2.2" stroke="currentColor" strokeWidth="2" />
      <path d="M2.8 8h14.4M10 8v9.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M10 8c0-3.1-2-5.2-4.3-5.2 0 3 2 5.2 4.3 5.2ZM10 8c0-3.1 2-5.2 4.3-5.2 0 3-2 5.2-4.3 5.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Variantes "pleines" — utilisées UNIQUEMENT dans le badge circulaire de
// QuestBoard (le badge fournit déjà le cercle du pourtour, un 2e contour
// DANS l'icône créait un double anneau visuel et une glyphe trop fine à
// 14px). Formes pleines et rondes, cohérentes avec le trait épais des
// versions "outline" ci-dessus.
export function IconFundFilled({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      {/* Gemme arrondie — silhouette à facettes douces plutôt qu'un
          losange à angles vifs, même logique "rien de pointu" que le
          reste de la passe Duolingo. */}
      <path d="M10 2.6c2 2.4 4.3 4.8 4.3 8 0 3.4-2.6 6.8-4.3 6.8s-4.3-3.4-4.3-6.8c0-3.2 2.3-5.6 4.3-8Z" />
      {/* Reflet — même logique que la version outline, en négatif (trait
          plus sombre que le fond du badge grâce à mix-blend-multiply,
          reste monochrome donc toujours safe dans un badge d'état). */}
      <path
        d="M8.7 6.4a5.6 5.6 0 0 0-1.8 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.35"
        style={{ mixBlendMode: 'multiply' }}
      />
    </svg>
  );
}

export function IconApproveFilled({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M4.2 10.4l3.4 3.4L15.8 5.8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconFinalizeFilled({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M4.6 2c.9 0 1.6.7 1.6 1.6v.2h8.3c1.5 0 2.3 1.8 1.3 2.9l-1.9 2.2 1.9 2.2c1 1.1.2 2.9-1.3 2.9H6.2v3.4c0 .9-.7 1.6-1.6 1.6S3 18.3 3 17.4V3.6C3 2.7 3.7 2 4.6 2Z" />
    </svg>
  );
}

export const CHRONICLE_ICON: Record<string, FC<IconProps>> = {
  create: IconCreate,
  approve: IconApprove,
  fund: IconFund,
  finalize: IconFinalize,
  distribute: IconDistribute,
  add_member: IconAddMember,
};

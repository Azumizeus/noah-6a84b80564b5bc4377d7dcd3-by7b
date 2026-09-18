// src/components/MiscIcons.tsx
// ═══════════════════════════════════════════════════════════════════
// 6 icônes SVG fournies par l'utilisateur (Recraft, 30/08, dossier
// "icone app/icone/") — remplacent les derniers emoji système restants
// (🔒🤝🔗📩💬🌱). Tracé conservé tel quel (bonne qualité, geometrie
// propre) — seule modif : couleur `#1B2A4A` en dur → `currentColor`,
// pour suivre la même règle que QuestIcons/RankIcons (l'icône doit
// suivre la couleur du texte/badge autour, pas imposer sa propre teinte).
// viewBox d'origine conservé par icône (24×24 pour la plupart, 16×16
// pour le cadenas) plutôt que retracé à une grille commune — le detail
// géométrique de chaque tracé fourni est fin, un rescale aurait plus de
// risques de casser les proportions qu'un viewBox différent par icône.
// ═══════════════════════════════════════════════════════════════════
import type { FC } from 'react';

interface IconProps {
  className?: string;
}

const BASE = 'h-3.5 w-3.5 shrink-0';

/** 🤝 approbation / pact — deux mains jointes. */
export function IconHandshake({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M3.2 19.2 L8.4 13.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20.8 19.2 L15.6 13.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M8.25 13.85
           C7.35 11.7 7.7 9.85 9.45 9.05
           C10.35 8.65 11.25 8.8 11.95 9.55
           C12.65 8.8 13.55 8.65 14.45 9.05
           C16.2 9.85 16.55 11.7 15.65 13.85
           C14.35 15.55 13.1 16.15 12 16.15
           C10.9 16.15 9.65 15.55 8.25 13.85 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10.2 9.1 L10.55 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.8 9.1 L13.45 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 💬 chat — bulle arrondie avec pointe. */
export function IconChatBubble({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7.15 3.7
           H16.85
           A4.15 4.15 0 0 1 21 7.85
           V13.55
           A4.15 4.15 0 0 1 16.85 17.7
           H10.35
           L6.05 21.15
           L7.25 17.7
           H7.15
           A4.15 4.15 0 0 1 3 13.55
           V7.85
           A4.15 4.15 0 0 1 7.15 3.7 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 🔒 confidentialité / verrouillé — cadenas fermé. */
export function IconLock({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5.5 7.25V5.15c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v2.1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="3.4" y="7.25" width="9.2" height="6.35" rx="1.7" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <circle cx="8" cy="10.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

/** 📩 contact / message reçu — enveloppe + flèche entrante. */
export function IconMailIn({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.8 V8.4 M9.15 6.1 L12 8.7 L14.85 6.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="3.4" y="10.2" width="17.2" height="11.1" rx="2.1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.2 11.15 L12 16.35 L19.8 11.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 🌱 création de pact — pousse à deux feuilles. */
export function IconSeedling({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 20.5 V12.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 13.55
           Q 8.05 13.15 6.35 8.15
           Q 10.55 8.55 12 13.55 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 11.7
           Q 16.05 11.15 17.65 6.05
           Q 13.35 6.65 12 11.7 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 🔗 lien / partage — deux maillons de chaîne. */
export function IconLink({ className = BASE }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

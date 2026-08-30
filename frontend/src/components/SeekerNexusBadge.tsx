// src/components/SeekerNexusBadge.tsx
// ═══════════════════════════════════════════════════════════════════
// Badge d'écosystème, flottant en bas à droite — remplace l'ancien badge
// « Made with Noah AI » qui était injecté sur toute l'application.
//
// Contraintes qui ont dicté la forme :
//
//  • Il est présent sur TOUTES les pages, donc il ne doit jamais masquer
//    un contrôle. D'où `pointer-events-none` sur le conteneur et
//    réactivation sur le seul lien : la zone morte autour du badge ne
//    bloque plus les clics de la page en dessous.
//
//  • Il suit le thème d'accent (variables CSS), sinon il jurerait dès
//    qu'un builder change de palette.
//
//  • Il se réduit sur mobile, où l'espace en bas d'écran est disputé
//    par la barre de navigation du navigateur.
// ═══════════════════════════════════════════════════════════════════

export function SeekerNexusBadge() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden"
      aria-hidden={false}
    >
      <a
        href="#/about"
        className="pointer-events-auto group inline-flex items-center gap-2.5 rounded-full
                   border border-white/10 bg-canvas-800/80 py-1.5 pl-2 pr-3.5
                   shadow-[0_8px_28px_-10px_rgba(0,0,0,0.9)] backdrop-blur-md
                   transition-colors hover:border-accent-violet/40 hover:bg-canvas-700/90"
      >
        <SeekerMark />
        <span className="flex flex-col leading-none">
          <span className="font-sans text-[11px] font-semibold tracking-tight text-white">
            Seeker<span className="text-accent-violet"> · Nexus</span>
          </span>
          {/* Masqué sur mobile : à cette largeur la seconde ligne fait
              déborder le badge sur le contenu. */}
          <span className="mt-0.5 hidden font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-400 sm:block">
            Ecosystem
          </span>
        </span>
      </a>
    </div>
  );
}

/** Hexagone + orbite — repris de la géométrie du LogoMark pour rester cohérent. */
function SeekerMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 2.5l8 4.75v9.5L12 21.5 4 16.75v-9.5L12 2.5z"
        stroke="rgb(var(--accent-violet-rgb) / 0.85)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="rgb(var(--accent-violet-rgb) / 0.10)"
      />
      <circle cx="12" cy="12" r="2.6" fill="rgb(var(--accent-neon-rgb))" />
      <circle cx="18.2" cy="7.6" r="1.5" fill="rgb(var(--accent-gold-rgb))" />
    </svg>
  );
}

export default SeekerNexusBadge;

// src/components/ClaimBurst.tsx
// ═══════════════════════════════════════════════════════════════════
// Micro-animation de réclamation — petit éclat de particules quand une
// quête est réclamée avec succès. Pur CSS (@keyframes dans index.css),
// pas de librairie. Respecte prefers-reduced-motion via la même classe
// que le reste de l'app (voir index.css : .animate-float etc. y sont
// déjà neutralisés sous ce media query, `.quest-burst-particle` suit la
// même convention).
// ═══════════════════════════════════════════════════════════════════
// 8 angles fixes plutôt que Math.random() — déterministe, pas de flash
// visuel différent à chaque re-render, et aucun souci d'hydratation.
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function ClaimBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {ANGLES.map((deg, i) => (
        <span
          key={deg}
          className="quest-burst-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={{
            // Alterne les 3 couleurs de rôle du projet plutôt qu'une seule
            // teinte — lisible comme "récompense", pas comme un accent de
            // palette en particulier.
            background: ['rgb(var(--accent-gold-rgb))', 'rgb(var(--accent-neon-rgb))', 'rgb(var(--accent-violet-rgb))'][i % 3],
            // Variable CSS lue par le @keyframes quest-burst (index.css) —
            // l'angle ne peut pas être posé via `transform` inline seul,
            // l'animation écrase `transform` pendant sa durée.
            ['--burst-angle' as string]: `${deg}deg`,
            animationDelay: `${i * 15}ms`,
          }}
        />
      ))}
    </span>
  );
}

export default ClaimBurst;

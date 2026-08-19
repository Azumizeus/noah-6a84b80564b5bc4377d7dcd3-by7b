// src/components/DashboardLayout.tsx
import { motion, MotionConfig, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

interface DashboardLayoutProps {
  children: ReactNode;
  walletSlot?: ReactNode;
  navLinks?: NavLink[];
}

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Dashboard', href: '#/', active: true },
  { label: 'Pacts',     href: '#/pacts' },
  { label: 'Treasury',  href: '#/treasury' },
  { label: 'Docs',      href: '#/docs' },
];

// Variants Framer — conteneur staggeré 0.08s, enfant fade-in-up 12px
const containerVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Helper — wrap d'une section enfant pour bénéficier du stagger du parent */
export function FadeInUp({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

export function DashboardLayout({
  children,
  walletSlot,
  navLinks = DEFAULT_LINKS,
}: DashboardLayoutProps) {
  const prefersReduced = useReducedMotion();
  // Si reduced motion, on saute l'état hidden initial — rendu immédiat
  const motionProps = prefersReduced
    ? { initial: false as const, animate: 'visible' as const }
    : { initial: 'hidden' as const, animate: 'visible' as const };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-hidden bg-base">
        {/* Grille décorative */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 grid-bg opacity-70" />

        {/* Orbes flottants — 100% CSS radial-gradient, aucune image externe */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full opacity-30 blur-3xl animate-float"
            style={{ background: 'radial-gradient(circle, rgba(153,69,255,0.45), transparent 70%)' }}
          />
          <div
            className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl animate-float"
            style={{
              background: 'radial-gradient(circle, rgba(20,241,149,0.35), transparent 70%)',
              animationDelay: '2s',
            }}
          />
          <div
            className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl animate-float"
            style={{
              background: 'radial-gradient(circle, rgba(255,215,0,0.25), transparent 70%)',
              animationDelay: '4s',
            }}
          />
        </div>

        {/* Skip link pour clavier / screen reader */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                     focus:rounded-lg focus:bg-base-700 focus:px-4 focus:py-2 focus:text-white"
        >
          Aller au contenu principal
        </a>

        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 sm:px-8 lg:px-8">
          {/* En-tête — sticky safe, h-16 cohérent */}
          <header className="flex h-16 items-center justify-between gap-4 py-4">
            <a
              href="#/"
              className="flex items-center gap-2.5 rounded-xl"
              aria-label="BuildPact — accueil"
            >
              <LogoMark />
              <span className="font-sans text-base font-semibold tracking-tight text-white">
                Build<span className="text-accent-violet">Pact</span>
              </span>
            </a>

            <nav aria-label="Navigation principale" className="hidden md:block">
              <ul className="flex items-center gap-1">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      aria-current={l.active ? 'page' : undefined}
                      className={
                        'inline-flex h-11 items-center rounded-lg px-3 text-sm transition-colors ' +
                        (l.active
                          ? 'bg-violet-500/10 text-white'
                          : 'text-ink-300 hover:text-white hover:bg-white/[0.03]')
                      }
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-2">{walletSlot}</div>
          </header>

          <motion.main
            id="main-content"
            {...motionProps}
            variants={containerVariants}
            className="pb-24 pt-4 sm:pt-6"
          >
            {children}
          </motion.main>

          <footer className="border-t border-violet-500/10 py-6 text-xs text-ink-500">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <p>© {new Date().getFullYear()} BuildPact Protocol · Devnet</p>
             <p className="font-mono">
  Built on <span className="text-accent-violet">Solana</span> ·{' '}
  <span className="text-accent-gold">Unaudited — Devnet only</span>
</p>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}

function LogoMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#0A0A18" stroke="#9945FF" strokeOpacity="0.5" />
      <path
        d="M10 22V10h6a4 4 0 0 1 0 8h-3"
        stroke="#14F195"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="11" r="2" fill="#FFD700" />
    </svg>
  );
}

export default DashboardLayout;

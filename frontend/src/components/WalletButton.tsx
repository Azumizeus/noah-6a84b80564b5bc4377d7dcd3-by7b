// src/components/WalletButton.tsx
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
<<<<<<< HEAD
=======
import { useLanguage } from '../lib/i18n/LanguageContext';
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3

type WalletButtonProps = {
  connected: boolean;
  connecting: boolean;
  address?: string | null;
  balance?: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

/** Troncation standard 4…4 pour adresses base58 Solana */
function truncateAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton({
  connected,
  connecting,
  address,
  balance,
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
<<<<<<< HEAD
=======
  const { t } = useLanguage();
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  // Ferme le menu sur clic extérieur ou Échap — gestion clavier AAA
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!connected) {
    return (
      <button
        type="button"
        onClick={onConnect}
        disabled={connecting}
<<<<<<< HEAD
        aria-label="Connecter un portefeuille Solana"
=======
        aria-label={t('walletButton.connectAria')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
        aria-busy={connecting}
        className="btn-primary"
      >
        {connecting ? (
          <>
            <Spinner />
<<<<<<< HEAD
            <span>Connexion…</span>
=======
            <span>{t('walletButton.connecting')}</span>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </>
        ) : (
          <>
            <WalletIcon />
<<<<<<< HEAD
            <span>Connect Wallet</span>
=======
            <span>{t('walletButton.connect')}</span>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </>
        )}
      </button>
    );
  }

  const display = address ? truncateAddress(address) : 'Connected';
  const solscanHref = address
    ? `https://solscan.io/account/${address}?cluster=devnet`
    : '#';

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
<<<<<<< HEAD
        aria-label={`Portefeuille connecté : ${address ?? ''}. Ouvrir le menu.`}
=======
        aria-label={t('walletButton.menuAria', { address: address ?? '' })}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
        className="glass-panel glass-panel-hover flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-neon-500 opacity-60 animate-pulse-ring" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-500" />
        </span>
        <span className="font-mono text-sm tabular-nums text-white">{display}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Menu portefeuille"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: prefersReduced ? 0 : 0.16, ease: 'easeOut' }}
            className="glass-panel absolute right-0 top-[calc(100%+8px)] z-50 w-64 p-2"
          >
            <div className="px-3 py-2">
<<<<<<< HEAD
              <p className="text-xs uppercase tracking-wider text-ink-400">Solde</p>
=======
              <p className="text-xs uppercase tracking-wider text-ink-400">{t('walletButton.balance')}</p>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
              <p className="mt-1 font-mono text-lg tabular-nums text-white">
                {balance != null ? balance.toFixed(4) : '0.0000'}{' '}
                <span className="text-accent-violet">SOL</span>
              </p>
            </div>
            <div className="my-1 h-px bg-violet-500/15" />
            <a
              href={solscanHref}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink-200 hover:bg-violet-500/10 hover:text-white"
            >
<<<<<<< HEAD
              <ExternalLinkIcon /> Voir sur Solscan
=======
              <ExternalLinkIcon /> {t('walletButton.viewSolscan')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            </a>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
              className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-gold-400 hover:bg-gold/10"
            >
<<<<<<< HEAD
              <DisconnectIcon /> Déconnecter
=======
              <DisconnectIcon /> {t('walletButton.disconnect')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 8.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 4V3a1 1 0 0 1 1-1h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 3h4v4M13 3l-6 6M11 9v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4M11 8h4M12 5l3 3-3 3"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default WalletButton;

// src/components/PactCard.tsx
import { motion, useReducedMotion } from 'framer-motion';

type PactStatus = 'active' | 'pending' | 'closed';

type PactCardProps = {
  id: string;
  title: string;
  counterparty: string; // attendu pré-tronqué "4…4"
  shareBps: number;     // 2500 = 25.00%
  claimable: number;    // SOL
  totalEarned: number;  // SOL
  status: PactStatus;
  lastClaimAt?: string;
  onClaim?: (id: string) => void;
  claiming?: boolean;
};

const STATUS_BADGE: Record<PactStatus, { cls: string; label: string }> = {
  active:  { cls: 'badge-active',  label: 'Actif' },
  pending: { cls: 'badge-pending', label: 'En attente' },
  closed:  { cls: 'badge-closed',  label: 'Clôturé' },
};

export function PactCard({
  id,
  title,
  counterparty,
  shareBps,
  claimable,
  totalEarned,
  status,
  lastClaimAt,
  onClaim,
  claiming = false,
}: PactCardProps) {
  const prefersReduced = useReducedMotion();
  const badge = STATUS_BADGE[status];
  const sharePct = (shareBps / 100).toFixed(2);
  const canClaim = status !== 'closed' && claimable > 0 && !claiming;

  return (
    <motion.article
      whileHover={prefersReduced || !canClaim ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="glass-panel glass-panel-hover p-5"
      aria-labelledby={`pact-title-${id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`badge ${badge.cls}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {badge.label}
          </span>
          <h3
            id={`pact-title-${id}`}
            className="mt-2 truncate text-base font-semibold text-white"
            title={title}
          >
            {title}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-ink-400">
            Counterparty: <span className="text-ink-300">{counterparty}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-500">Your share</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-accent-violet">
            {sharePct}%
          </p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/[0.02] p-3">
          <dt className="text-xs text-ink-500">Claimable</dt>
          <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-accent-neon">
            {claimable.toFixed(4)} SOL
          </dd>
        </div>
        <div className="rounded-lg bg-white/[0.02] p-3">
          <dt className="text-xs text-ink-500">Total earned</dt>
          <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-white">
            {totalEarned.toFixed(4)} SOL
          </dd>
        </div>
      </dl>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-ink-500">
          {lastClaimAt ? `Last claim ${lastClaimAt}` : 'Aucun claim'}
        </span>
        <button
          type="button"
          onClick={() => onClaim?.(id)}
          disabled={!canClaim}
          aria-label={`Réclamer ${claimable.toFixed(4)} SOL du pact ${title}`}
          className="btn-neon"
        >
          {claiming ? 'Claiming…' : `Claim ${claimable.toFixed(2)} SOL`}
        </button>
      </footer>
    </motion.article>
  );
}

export default PactCard;

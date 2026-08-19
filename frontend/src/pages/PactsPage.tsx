// src/pages/PactsPage.tsx
import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import PactCard from '../components/PactCard';
import { PACTS, type PactStatus } from '../lib/pacts';

type Filter = 'all' | PactStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'pending', label: 'En attente' },
  { key: 'closed', label: 'Clôturés' },
];

export function PactsPage() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [filter, setFilter] = useState<Filter>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = useCallback(
    (id: string) => {
      if (!connected) { setVisible(true); return; }
      setClaimingId(id);
      window.setTimeout(() => setClaimingId(null), 1500);
    },
    [connected, setVisible],
  );

  const visible = filter === 'all' ? PACTS : PACTS.filter((p) => p.status === filter);

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Pacts</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tous vos <span className="text-accent-violet">pactes</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Filtrez et gérez l'ensemble de vos pactes de revenue share.
          </p>
        </header>
      </FadeInUp>

      <FadeInUp>
        <div role="tablist" aria-label="Filtrer par statut" className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={
                'inline-flex h-9 items-center rounded-lg px-3 text-sm transition-colors ' +
                (filter === f.key
                  ? 'bg-violet-500/15 text-white ring-1 ring-violet-500/40'
                  : 'text-ink-300 hover:bg-white/[0.03] hover:text-white')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </FadeInUp>

      <section aria-label="Pactes filtrés" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((p) => (
          <FadeInUp key={p.id}>
            <PactCard id={p.id} title={p.title} counterparty={p.counterparty} shareBps={p.shareBps}
              claimable={p.claimable} totalEarned={p.totalEarned} status={p.status}
              lastClaimAt={p.lastClaimAt} onClaim={handleClaim} claiming={claimingId === p.id} />
          </FadeInUp>
        ))}
      </section>
    </DashboardLayout>
  );
}

export default PactsPage;

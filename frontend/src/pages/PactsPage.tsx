// src/pages/PactsPage.tsx
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import TxBanner from '../components/TxBanner';
import AppWalletButton from '../components/AppWalletButton';
import { useProjects, usePactActions } from '../hooks/useProjects';

type Filter = 'all' | 'active' | 'pending';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Finalisés' },
  { id: 'pending', label: 'Ouverts' },
];

export function PactsPage() {
  const { connected } = useWallet();
  const { pacts, loading, error, refresh } = useProjects();
  const { busyId, busyAction, txState, runDistribute, runFund } = usePactActions(refresh);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = pacts.filter((p) => filter === 'all' || p.status === filter);

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Pacts</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tous les projets <span className="text-accent-violet">on-chain</span>
          </h1>
        </header>
      </FadeInUp>

      <FadeInUp><TxBanner state={txState} /></FadeInUp>

      {error && (
        <FadeInUp>
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Erreur RPC : {error}
          </p>
        </FadeInUp>
      )}

      <FadeInUp>
        <div className="mb-5 mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={
                'inline-flex h-11 items-center rounded-xl border px-4 text-sm transition-colors ' +
                (filter === f.id
                  ? 'border-accent-violet/40 bg-violet-500/15 text-white'
                  : 'border-white/10 text-ink-300 hover:bg-white/5 hover:text-white')
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </FadeInUp>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-panel h-56 animate-pulse rounded-2xl" aria-hidden="true" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <FadeInUp>
          <EmptyState
            title="Aucun projet"
            description="Aucun projet ne correspond à ce filtre sur le program (devnet)."
            ctaLabel="Voir la documentation"
            onCta={() => { window.location.hash = '#/docs'; }}
          />
        </FadeInUp>
      ) : (
        <section aria-label="Liste complète des projets" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((pact) => (
            <FadeInUp key={pact.pda.toBase58()}>
              <PactCard
                pact={pact}
                walletConnected={connected}
                busyAction={busyId === pact.pda.toBase58() ? busyAction : null}
                onDistribute={runDistribute}
                onFund={runFund}
              />
            </FadeInUp>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

export default PactsPage;

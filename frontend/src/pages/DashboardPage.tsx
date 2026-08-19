// src/pages/DashboardPage.tsx
import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import StatsCard from '../components/StatsCard';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import { PACTS } from '../lib/pacts';

export function DashboardPage() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = useCallback(
    (id: string) => {
      if (!connected) { setVisible(true); return; }
      setClaimingId(id);
      window.setTimeout(() => setClaimingId(null), 1500);
    },
    [connected, setVisible],
  );

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Revenue Share Protocol</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your on-chain earnings, <span className="text-accent-violet">unlocked.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Visualisez, réclamez et suivez vos pactes de partage de revenus en temps réel sur Solana devnet.
          </p>
        </header>
      </FadeInUp>

      <section aria-label="Statistiques globales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FadeInUp><StatsCard label="Total Earned" value={142.587} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel="Lifetime on-chain" /></FadeInUp>
        <FadeInUp><StatsCard label="Claimable" value={18.423} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel="Ready to claim now" /></FadeInUp>
        <FadeInUp><StatsCard label="Active Pacts" value={7} decimals={0} icon="pacts" accent="gold" sublabel="2 pending signature" /></FadeInUp>
      </section>

      <FadeInUp>
        <div className="mb-4 mt-10 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-white">Active Pacts</h2>
          <a href="#/pacts" className="text-sm text-ink-300 underline-offset-4 hover:text-white hover:underline">View all</a>
        </div>
      </FadeInUp>

      {PACTS.length === 0 ? (
        <FadeInUp>
          <EmptyState title="Aucun pact actif" description="Créez votre premier pact de partage de revenus pour commencer à percevoir vos royalties on-chain." ctaLabel="Create a Pact" onCta={() => undefined} />
        </FadeInUp>
      ) : (
        <section aria-label="Liste des pactes" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PACTS.map((p) => (
            <FadeInUp key={p.id}>
              <PactCard id={p.id} title={p.title} counterparty={p.counterparty} shareBps={p.shareBps}
                claimable={p.claimable} totalEarned={p.totalEarned} status={p.status}
                lastClaimAt={p.lastClaimAt} onClaim={handleClaim} claiming={claimingId === p.id} />
            </FadeInUp>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

export default DashboardPage;

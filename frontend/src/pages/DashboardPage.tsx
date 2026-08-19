// src/pages/DashboardPage.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import StatsCard from '../components/StatsCard';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import TxBanner from '../components/TxBanner';
import AppWalletButton from '../components/AppWalletButton';
import { useProjects, usePactActions } from '../hooks/useProjects';

export function DashboardPage() {
  const { connected } = useWallet();
  const { pacts, loading, error, refresh } = useProjects();
  const { busyId, busyAction, txState, runDistribute, runFund } = usePactActions(refresh);

  const totalVault = pacts.reduce((s, p) => s + p.vaultBalanceSol, 0);
  const myClaimable = pacts.reduce((s, p) => s + p.myClaimableSol, 0);
  const activeCount = pacts.filter((p) => p.status === 'active').length;
  const preview = pacts.slice(0, 4);

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">
            Revenue Share Protocol
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your on-chain earnings, <span className="text-accent-violet">unlocked.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Données réelles lues directement depuis le program Solana (devnet).
          </p>
        </header>
      </FadeInUp>

      <FadeInUp>
        <TxBanner state={txState} />
      </FadeInUp>

      {error && (
        <FadeInUp>
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            Erreur RPC : {error}
          </p>
        </FadeInUp>
      )}

      {/* Stats */}
      <section aria-label="Statistiques globales" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-28 animate-pulse rounded-2xl" aria-hidden="true" />
          ))
        ) : (
          <>
            <FadeInUp>
              <StatsCard label="Vaults Total" value={totalVault} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel={`${pacts.length} projet(s) on-chain`} />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label="Your Claimable" value={myClaimable} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel="Quote-part de vos vaults" />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label="Finalized Projects" value={activeCount} decimals={0} icon="pacts" accent="gold" sublabel={`${pacts.length - activeCount} ouvert(s)`} />
            </FadeInUp>
          </>
        )}
      </section>

      <FadeInUp>
        <div className="mb-4 mt-10 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-white">Projects</h2>
          <a href="#/pacts" className="text-sm text-ink-300 underline-offset-4 hover:text-white hover:underline">
            View all
          </a>
        </div>
      </FadeInUp>

      {!loading && preview.length === 0 ? (
        <FadeInUp>
          <EmptyState
            title="Aucun projet on-chain"
            description="Aucun compte Project trouvé sur ce program (devnet). Créez votre premier pact pour commencer."
            ctaLabel="Lire la documentation"
            onCta={() => { window.location.hash = '#/docs'; }}
          />
        </FadeInUp>
      ) : (
        <section aria-label="Liste des projets" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {preview.map((pact) => (
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

export default DashboardPage;

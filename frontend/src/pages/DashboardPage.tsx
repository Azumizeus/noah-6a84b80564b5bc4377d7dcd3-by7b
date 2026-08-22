// src/pages/DashboardPage.tsx
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import StatsCard from '../components/StatsCard';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import TxBanner from '../components/TxBanner';
import AppWalletButton from '../components/AppWalletButton';
import { useProjects, usePactActions } from '../hooks/useProjects';
<<<<<<< HEAD

export function DashboardPage() {
  const { connected } = useWallet();
  const { pacts, loading, error, refresh } = useProjects();
  const { busyId, busyAction, txState, runDistribute, runFund, runFinalize } = usePactActions(refresh);
=======
import { useLanguage } from '../lib/i18n/LanguageContext';

export function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const { t } = useLanguage();
  const { pacts, loading, error, refresh } = useProjects();
  const { busyId, busyAction, txState, runDistribute, runFund, runFinalize, clearTxState } = usePactActions(refresh);
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3

  const totalVault = pacts.reduce((s, p) => s + p.vaultBalanceSol, 0);
  const myClaimable = pacts.reduce((s, p) => s + p.myClaimableSol, 0);
  const activeCount = pacts.filter((p) => p.status === 'active').length;
<<<<<<< HEAD
  const preview = pacts.slice(0, 4);
=======

  // Priorité aux pacts où le wallet connecté est membre ou créateur — avant,
  // cette liste montrait les 4 premiers pacts de TOUT le protocole, pas les
  // siens, ce qui rendait l'accès à "son" pact confus (retour utilisateur).
  const myAddr = publicKey?.toBase58();
  const myPacts = pacts.filter((p) => !!myAddr && (p.creator.toBase58() === myAddr || p.members.some((m) => m.wallet.toBase58() === myAddr)));
  const showingMine = myPacts.length > 0;
  const preview = (showingMine ? myPacts : pacts).slice(0, 4);
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">
<<<<<<< HEAD
            Revenue Share Protocol
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your on-chain earnings, <span className="text-accent-violet">unlocked.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Données réelles lues directement depuis le program Solana (devnet).
=======
            {t('dashboard.eyebrow')}
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('dashboard.titleLine1')} <span className="text-accent-violet">{t('dashboard.titleLine2')}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            {t('dashboard.subtitle')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </p>
        </header>
      </FadeInUp>

      <FadeInUp>
<<<<<<< HEAD
        <TxBanner state={txState} />
=======
        <TxBanner state={txState} onDismiss={clearTxState} />
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
      </FadeInUp>

      {error && (
        <FadeInUp>
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
<<<<<<< HEAD
            Erreur RPC : {error}
=======
            {t('common.rpcErrorPrefix')} {error}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
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
<<<<<<< HEAD
              <StatsCard label="Vaults Total" value={totalVault} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel={`${pacts.length} projet(s) on-chain`} />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label="Your Claimable" value={myClaimable} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel="Quote-part de vos vaults" />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label="Finalized Projects" value={activeCount} decimals={0} icon="pacts" accent="gold" sublabel={`${pacts.length - activeCount} ouvert(s)`} />
=======
              <StatsCard label={t('dashboard.statVaultsLabel')} value={totalVault} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel={t('dashboard.statVaultsSublabel', { n: pacts.length })} />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label={t('dashboard.statClaimableLabel')} value={myClaimable} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel={t('dashboard.statClaimableSublabel')} />
            </FadeInUp>
            <FadeInUp>
              <StatsCard label={t('dashboard.statFinalizedLabel')} value={activeCount} decimals={0} icon="pacts" accent="gold" sublabel={t('dashboard.statFinalizedSublabel', { n: pacts.length - activeCount })} />
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            </FadeInUp>
          </>
        )}
      </section>

      <FadeInUp>
        <div className="mb-4 mt-10 flex items-center justify-between">
<<<<<<< HEAD
          <h2 className="font-sans text-lg font-semibold text-white">Projects</h2>
          <a href="#/pacts" className="text-sm text-ink-300 underline-offset-4 hover:text-white hover:underline">
            View all
=======
          <h2 className="font-sans text-lg font-semibold text-white">
            {showingMine ? t('dashboard.myProjectsHeading') : t('dashboard.projectsHeading')}
          </h2>
          <a href={showingMine ? '#/pacts?mine=1' : '#/pacts'} className="text-sm text-ink-300 underline-offset-4 hover:text-white hover:underline">
            {showingMine ? t('dashboard.viewAllMine') : t('dashboard.viewAll')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </a>
        </div>
      </FadeInUp>

<<<<<<< HEAD
      {!loading && preview.length === 0 ? (
        <FadeInUp>
          <EmptyState
            title="Aucun projet on-chain"
            description="Aucun compte Project trouvé sur ce program (devnet). Créez votre premier pact pour commencer."
            ctaLabel="Lire la documentation"
=======
      {!loading && preview.length === 0 && connected && myPacts.length === 0 && pacts.length > 0 ? (
        <FadeInUp>
          <EmptyState
            title={t('dashboard.emptyMineTitle')}
            description={t('dashboard.emptyMineDesc')}
            ctaLabel={t('dashboard.emptyMineCta')}
            onCta={() => { window.location.hash = '#/marketplace'; }}
          />
        </FadeInUp>
      ) : !loading && preview.length === 0 ? (
        <FadeInUp>
          <EmptyState
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDesc')}
            ctaLabel={t('dashboard.emptyCta')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
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
                onFinalize={runFinalize}
<<<<<<< HEAD
=======
                clearTopBanner={clearTxState}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
              />
            </FadeInUp>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

export default DashboardPage;

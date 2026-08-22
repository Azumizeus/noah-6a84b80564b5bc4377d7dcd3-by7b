// src/pages/PactsPage.tsx
<<<<<<< HEAD
import { useState } from 'react';
=======
import { useEffect, useState } from 'react';
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import TxBanner from '../components/TxBanner';
import AppWalletButton from '../components/AppWalletButton';
import { CreatePactWizard } from '../components/CreatePactWizard';
import { useProjects, usePactActions } from '../hooks/useProjects';
<<<<<<< HEAD

type Filter = 'all' | 'active' | 'pending';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Finalisés' },
  { id: 'pending', label: 'Ouverts' },
];

export function PactsPage() {
  const { connected } = useWallet();
  const { pacts, loading, error, refresh } = useProjects();
  const { busyId, busyAction, txState, runDistribute, runFund, runFinalize } = usePactActions(refresh);
  const [filter, setFilter] = useState<Filter>('all');
  const [wizardOpen, setWizardOpen] = useState(false);

  const visible = pacts.filter((p) => filter === 'all' || p.status === filter);
=======
import { useProjectMedia } from '../hooks/useProjectMedia';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { usePactsMineParam } from '../lib/router';

type Filter = 'all' | 'active' | 'pending' | 'mine';

export function PactsPage() {
  const { connected, publicKey } = useWallet();
  const { t } = useLanguage();
  const myAddr = publicKey?.toBase58();
  const wantsMine = usePactsMineParam();
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: t('pacts.filterAll') },
    { id: 'active', label: t('pacts.filterActive') },
    { id: 'pending', label: t('pacts.filterPending') },
    ...(connected ? [{ id: 'mine' as Filter, label: t('pacts.filterMine') }] : []),
  ];
  const { pacts, loading, error, refresh } = useProjects();
  const { media, refresh: refreshMedia } = useProjectMedia();
  const { busyId, busyAction, txState, runDistribute, runFund, runFinalize, clearTxState } = usePactActions(refresh);
  // ?mine=1 (lien depuis le Dashboard) présélectionne le filtre "Mes Pacts"
  // dès l'arrivée sur la page, uniquement si un wallet est connecté.
  const [filter, setFilter] = useState<Filter>(wantsMine && connected ? 'mine' : 'all');

  // Le wallet peut se (re)connecter juste après le premier rendu (autoConnect
  // async) — sans cet effet, ?mine=1 arrivé avant la connexion resterait sur
  // 'all' même une fois connecté.
  useEffect(() => {
    if (wantsMine && connected) setFilter('mine');
  }, [wantsMine, connected]);
  const [wizardOpen, setWizardOpen] = useState(false);

  const visible = pacts.filter((p) => {
    if (filter === 'mine') {
      return !!myAddr && (p.creator.toBase58() === myAddr || p.members.some((m) => m.wallet.toBase58() === myAddr));
    }
    return filter === 'all' || p.status === filter;
  });
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
<<<<<<< HEAD
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Pacts</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Tous les projets <span className="text-accent-violet">on-chain</span>
=======
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">{t('pacts.eyebrow')}</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('pacts.titleLine1')} <span className="text-accent-violet">{t('pacts.titleLine2')}</span>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </h1>
        </header>
      </FadeInUp>

<<<<<<< HEAD
      <FadeInUp><TxBanner state={txState} /></FadeInUp>
=======
      <FadeInUp><TxBanner state={txState} onDismiss={clearTxState} /></FadeInUp>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3

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
          {connected && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex h-11 items-center rounded-xl bg-accent-neon px-4 text-sm font-bold text-ink-900 hover:opacity-90"
            >
<<<<<<< HEAD
              + Créer un pact
=======
              {t('pacts.createButton')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            </button>
          )}
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
<<<<<<< HEAD
            title="Aucun projet"
            description="Aucun projet ne correspond à ce filtre sur le program (devnet)."
            ctaLabel="Voir la documentation"
=======
            title={t('pacts.emptyTitle')}
            description={t('pacts.emptyDesc')}
            ctaLabel={t('pacts.emptyCta')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            onCta={() => { window.location.hash = '#/docs'; }}
          />
        </FadeInUp>
      ) : (
<<<<<<< HEAD
        <section aria-label="Liste complète des projets" className="grid grid-cols-1 gap-4 md:grid-cols-2">
=======
        <section aria-label={t('pacts.listAria')} className="grid grid-cols-1 gap-4 md:grid-cols-2">
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          {visible.map((pact) => (
            <FadeInUp key={pact.pda.toBase58()}>
              <PactCard
                pact={pact}
                walletConnected={connected}
                busyAction={busyId === pact.pda.toBase58() ? busyAction : null}
                onDistribute={runDistribute}
<<<<<<< HEAD
                onFund={runFund}
                onFinalize={runFinalize}
=======
                onDistributed={refresh}
                onFund={runFund}
                onFinalize={runFinalize}
                clearTopBanner={clearTxState}
                media={media.get(pact.pda.toBase58())}
                onMediaUpdated={refreshMedia}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
              />
            </FadeInUp>
          ))}
        </section>
      )}

      {wizardOpen && (
        <div
<<<<<<< HEAD
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setWizardOpen(false)}
        >
          <div className="max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
=======
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => {
            // Clic hors modale = même chemin que le bouton croix : on refresh
            // aussi, pour la même raison (voir commentaire sur onClose ci-dessous).
            setWizardOpen(false);
            refresh();
            refreshMedia();
          }}
        >
          <div
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            <CreatePactWizard
              onSuccess={() => {
                setWizardOpen(false);
                refresh();
<<<<<<< HEAD
=======
                refreshMedia();
              }}
              onClose={() => {
                // Refresh même sur une simple fermeture (croix / clic hors modale) :
                // un projet a très bien pu être créé/des membres ajoutés on-chain
                // avant que l'utilisateur ferme sans passer par le bouton de succès
                // — sans ce refresh, le nouveau pact n'apparaît qu'après un reload
                // manuel de la page.
                setWizardOpen(false);
                refreshMedia();
                refresh();
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
              }}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PactsPage;

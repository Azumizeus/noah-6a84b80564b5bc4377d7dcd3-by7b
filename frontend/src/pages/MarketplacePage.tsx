// src/pages/MarketplacePage.tsx
// ═══════════════════════════════════════════════════════════════════
// Discovery / Marketplace — J-4 CRITIQUE. Vue orientée "candidat/
// investisseur" : qui cherche quoi, combien de parts restent, combien
// est déjà financé. Toutes les données viennent du program on-chain
// (useProjects, déjà utilisé ailleurs) — aucune donnée mock.
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import MarketplaceCard from '../components/MarketplaceCard';
import ApplyModal from '../components/ApplyModal';
import EmptyState from '../components/EmptyState';
import StatsCard from '../components/StatsCard';
import { useProjects } from '../hooks/useProjects';
import { useProjectMedia } from '../hooks/useProjectMedia';
import type { ChainPact } from '../lib/pacts';
import { useLanguage } from '../lib/i18n/LanguageContext';

type Filter = 'all' | 'recruiting' | 'funding';

// ⚠️ Pagination CÔTÉ CLIENT uniquement : la liste complète est déjà chargée
// en un seul appel RPC (getProgramAccounts via program.account.project.all()
// dans useProjects()) — ça ne réduit PAS le coût réseau à grande échelle,
// juste le rendu affiché. Le vrai fix à l'échelle (milliers/millions de
// projets) demande un indexeur off-chain + pagination serveur — hors scope
// hackathon, noté en v2 post-hackathon.
const PAGE_SIZE = 12;

export function MarketplacePage() {
  const { t } = useLanguage();
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: t('marketplace.filterAll') },
    { id: 'recruiting', label: t('marketplace.filterRecruiting') },
    { id: 'funding', label: t('marketplace.filterFunding') },
  ];
  const { pacts, loading, error } = useProjects();
  const { media } = useProjectMedia();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [applyTarget, setApplyTarget] = useState<ChainPact | null>(null);

  const recruitingCount = pacts.filter((p) => p.status !== 'active').length;
  const fundingCount = pacts.filter((p) => p.status === 'active').length;

  const visible = pacts.filter((p) => {
    if (filter === 'recruiting') return p.status !== 'active';
    if (filter === 'funding') return p.status === 'active';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Le filtre change la liste → la page courante peut ne plus exister (ex:
  // on était page 3, le filtre ne renvoie que 1 page) : on recadre au lieu
  // d'afficher une grille vide par erreur.
  const safePage = Math.min(page, totalPages);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">{t('marketplace.eyebrow')}</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('marketplace.titleLine1')} <span className="text-accent-violet">{t('marketplace.titleLine2')}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            {t('marketplace.subtitle')}
          </p>
        </header>
      </FadeInUp>

      {error && (
        <FadeInUp>
          <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {t('common.rpcErrorPrefix')} {error}
          </p>
        </FadeInUp>
      )}

      <section aria-label={t('marketplace.eyebrow')} className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FadeInUp>
          <StatsCard label={t('marketplace.statRecruitingLabel')} value={recruitingCount} decimals={0} icon="pacts" accent="gold" sublabel={t('marketplace.statRecruitingSublabel')} loading={loading} />
        </FadeInUp>
        <FadeInUp>
          <StatsCard label={t('marketplace.statFundingLabel')} value={fundingCount} decimals={0} icon="earned" accent="neon" sublabel={t('marketplace.statFundingSublabel')} loading={loading} />
        </FadeInUp>
      </section>

      <FadeInUp>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => changeFilter(f.id)}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-72 animate-pulse rounded-2xl" aria-hidden="true" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <FadeInUp>
          <EmptyState
            title={t('marketplace.emptyTitle')}
            description={t('marketplace.emptyDesc')}
            ctaLabel={t('marketplace.emptyCta')}
            onCta={() => { window.location.hash = '#/pacts'; }}
          />
        </FadeInUp>
      ) : (
        <>
          <section aria-label="Projets" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((pact) => (
              <FadeInUp key={pact.pda.toBase58()}>
                <MarketplaceCard pact={pact} onApply={setApplyTarget} media={media.get(pact.pda.toBase58())} />
              </FadeInUp>
            ))}
          </section>

          {totalPages > 1 && (
            <nav aria-label="Pagination Marketplace" className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 transition hover:border-accent-violet/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('marketplace.prevPage')}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  // Grille compacte : si beaucoup de pages, on ne montre que
                  // les bornes + la page courante ± 1, avec des "…" entre —
                  // évite une rangée de 50 boutons illisible.
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                  .map((n, idx, arr) => (
                    <span key={n} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== n - 1 && (
                        <span className="px-1 text-xs text-ink-500" aria-hidden="true">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        aria-current={n === safePage ? 'page' : undefined}
                        className={
                          'inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs transition ' +
                          (n === safePage
                            ? 'border-accent-violet/40 bg-violet-500/15 text-white'
                            : 'border-white/10 text-ink-300 hover:border-accent-violet/40 hover:text-white')
                        }
                      >
                        {n}
                      </button>
                    </span>
                  ))}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 transition hover:border-accent-violet/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('marketplace.nextPage')}
              </button>
            </nav>
          )}
        </>
      )}

      {applyTarget && (
        <ApplyModal
          projectPda={applyTarget.pda.toBase58()}
          projectTitle={applyTarget.title}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </DashboardLayout>
  );
}

export default MarketplacePage;

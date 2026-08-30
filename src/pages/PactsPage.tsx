// src/pages/PactsPage.tsx
// ═══════════════════════════════════════════════════════════════════
// Onglet "/pacts" — liste complète avec filtres. Le filtre "Mes pacts"
// peut être pré-sélectionné par l'URL (#/pacts?mine=1), c'est ce que
// le Dashboard utilise pour renvoyer ici sans dupliquer sa logique.
//
// Vue liste/grille/vignettes + recherche + tri + pagination (30/08,
// demande explicite déjà faite plusieurs fois avant d'être livrée) —
// même infrastructure que Marketplace (voir MarketplacePage.tsx pour le
// jumeau de ces contrôles), adaptée ici à "mes pacts" : pas de filtre
// compétence/coffre (ça a du sens en découverte, pas ici), mais une
// recherche libre par nom OU par rôle recherché à la place.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProjects, usePactActions } from '../hooks/useProjects';
import { useProjectMedia } from '../hooks/useProjectMedia';
import { useOpenRoles } from '../hooks/useOpenRoles';
import { useProjectCreatedAt } from '../hooks/useProjectCreatedAt';
import { usePactsMineParam } from '../lib/router';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import EmptyState from '../components/EmptyState';
import PactCard from '../components/PactCard';
import PactTile from '../components/PactTile';
import ViewModeSwitch from '../components/ViewModeSwitch';
import { useDensity } from '../hooks/useDensity';
import { useViewMode } from '../hooks/useViewMode';
import TxBanner from '../components/TxBanner';
import { CreatePactWizard } from '../components/CreatePactWizard';

type Filter = 'all' | 'active' | 'pending' | 'mine';
type SortKey = 'default' | 'recent' | 'name' | 'status';

const PER_PAGE_KEY = 'buildpact_pacts_per_page';
const PER_PAGE_OPTIONS = [12, 30, 60] as const;
function loadPerPage(): number {
  try {
    const raw = Number(localStorage.getItem(PER_PAGE_KEY));
    return (PER_PAGE_OPTIONS as readonly number[]).includes(raw) ? raw : 12;
  } catch {
    return 12;
  }
}

interface Props {
  /** BUG FIX (29/08) : CreatePactWizard existait dans le repo (components/
   *  CreatePactWizard.tsx) mais n'était monté nulle part — App.tsx rend
   *  <PactsPage /> sans prop, et le repli local se contentait de renvoyer
   *  vers le Dashboard, qui n'a lui-même aucun moyen d'ouvrir le wizard.
   *  Le bouton "Créer un pact" ne menait donc plus nulle part. La page
   *  gère maintenant le wizard elle-même (showCreate, plus bas) ; cette
   *  prop reste optionnelle pour un appelant externe qui voudrait piloter
   *  l'ouverture depuis l'extérieur, mais n'est plus requise. */
  onCreatePact?: () => void;
}

export default function PactsPage({ onCreatePact }: Props) {
  const [density] = useDensity();
  const [viewMode, setViewMode] = useViewMode();
  const [showCreate, setShowCreate] = useState(false);
  const createPact = onCreatePact ?? (() => setShowCreate(true));
  const { t } = useLanguage();
  const { connected, publicKey } = useWallet();
  const { pacts, loading, error, refresh } = useProjects();
  const { media, refresh: refreshMedia } = useProjectMedia();
  const { openRoles } = useOpenRoles();
  const createdAt = useProjectCreatedAt();
  const actions = usePactActions(refresh);
  const mineFromUrl = usePactsMineParam();

  const [filter, setFilter] = useState<Filter>(mineFromUrl ? 'mine' : 'all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  const [perPage, setPerPage] = useState<number>(() => loadPerPage());
  const [page, setPage] = useState(1);

  // Le hash peut changer alors que la page est déjà montée (clic sur un lien
  // "Voir tous mes pacts" depuis le Dashboard) — on resynchronise le filtre.
  useEffect(() => {
    if (mineFromUrl) setFilter('mine');
  }, [mineFromUrl]);

  const filtered = pacts.filter((p) => {
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'pending' && p.status === 'active') return false;
    if (filter === 'mine') {
      if (!publicKey) return false;
      const mine =
        p.creator.equals(publicKey) || p.members.some((m) => m.wallet.equals(publicKey));
      if (!mine) return false;
    }
    if (search.trim() !== '') {
      const q = search.trim().toLowerCase();
      const roles = openRoles.get(p.pda.toBase58()) ?? [];
      const matchesName = p.title.toLowerCase().includes(q);
      const matchesRole = roles.some((r) => r.toLowerCase().includes(q));
      if (!matchesName && !matchesRole) return false;
    }
    return true;
  });

  const visible = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'recent') {
        const da = createdAt.get(a.pda.toBase58()) ?? '';
        const db = createdAt.get(b.pda.toBase58()) ?? '';
        return db.localeCompare(da);
      }
      if (sort === 'name') return a.title.localeCompare(b.title);
      if (sort === 'status') {
        // Ouverts d'abord (encore recrute), finalisés ensuite.
        const aOpen = a.status !== 'active' ? 0 : 1;
        const bOpen = b.status !== 'active' ? 0 : 1;
        return aOpen - bOpen;
      }
      return 0; // 'default' — ordre de useProjects(), inchangé
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, createdAt]);

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const currentPage = Math.min(page, totalPages);
  // La vue "liste" garde tout affiché d'un coup (comportement d'origine,
  // PactCard est déjà dense en infos) — la pagination ne s'active que sur
  // grille/vignettes, pensées pour parcourir beaucoup de pacts vite.
  const paged = viewMode === 'list' ? visible : visible.slice((currentPage - 1) * perPage, currentPage * perPage);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const changeSort = (s: SortKey) => {
    setSort(s);
    setPage(1);
  };
  const changePerPage = (n: number) => {
    setPerPage(n);
    setPage(1);
    try {
      localStorage.setItem(PER_PAGE_KEY, String(n));
    } catch {
      /* non bloquant */
    }
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: t('pacts.filterAll') },
    { id: 'active', label: t('pacts.filterActive') },
    { id: 'pending', label: t('pacts.filterPending') },
    { id: 'mine', label: t('pacts.filterMine') },
  ];

  // ⚠️ PactsPage rend son propre layout : App.tsx ne fournit plus de coquille
  // (Index.tsx a été supprimé, c'était une invention absente du repo amont).
  return (
    <>
    <DashboardLayout walletSlot={<AppWalletButton />}>
    <div className="space-y-8">
      <FadeInUp>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-accent-neon">
              {t('pacts.eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              {t('pacts.titleLine1')}{' '}
              <span className="text-accent-violet">{t('pacts.titleLine2')}</span>
            </h1>
          </div>
          <button type="button" onClick={createPact} className="btn-primary">
            {t('pacts.createButton')}
          </button>
        </header>
      </FadeInUp>

      <FadeInUp>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => changeFilter(f.id)}
                disabled={f.id === 'mine' && !connected}
                className={
                  'rounded-full border px-4 py-1.5 text-xs transition-colors disabled:opacity-40 ' +
                  (filter === f.id
                    ? 'border-accent-violet/60 bg-violet-500/20 text-white'
                    : 'border-white/10 text-ink-300 hover:text-white')
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewModeSwitch value={viewMode} onChange={setViewMode} />
            <label className="flex items-center gap-1.5 text-xs text-ink-400">
              {t('marketplace.sortLabel')}
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white"
              >
                <option value="default">{t('marketplace.sortDefault')}</option>
                <option value="recent">{t('marketplace.sortRecent')}</option>
                <option value="name">{t('pacts.sortName')}</option>
                <option value="status">{t('pacts.sortStatus')}</option>
              </select>
            </label>
            {viewMode !== 'list' && (
              <label className="flex items-center gap-1.5 text-xs text-ink-400">
                {t('marketplace.perPageLabel')}
                <select
                  value={perPage}
                  onChange={(e) => changePerPage(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder={t('pacts.searchPlaceholder')}
          aria-label={t('pacts.searchLabel')}
          className="mt-3 w-full max-w-sm rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-ink-500 focus:border-accent-violet/50 focus:outline-none"
        />
      </FadeInUp>

      {actions.txState && (
        <FadeInUp>
          <TxBanner state={actions.txState} onDismiss={actions.clearTxState} />
        </FadeInUp>
      )}

      {error && (
        <FadeInUp>
          <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            {t('common.rpcErrorPrefix')} {error}
          </p>
        </FadeInUp>
      )}

      {loading && (
        <div className="grid gap-4">
          <div className="skeleton h-36 w-full rounded-2xl" aria-hidden="true" />
          <div className="skeleton h-36 w-full rounded-2xl" aria-hidden="true" />
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <FadeInUp>
          <EmptyState
            title={t('pacts.emptyTitle')}
            description={t('pacts.emptyDesc')}
            ctaLabel={t('pacts.createButton')}
            onCta={createPact}
          />
        </FadeInUp>
      )}

      {viewMode === 'list' ? (
        <section aria-label={t('pacts.listAria')} className={'grid ' + (density === 'compact' ? 'gap-2' : 'gap-4')}>
          {visible.map((p) => (
            <FadeInUp key={p.pda.toBase58()}>
              <PactCard
                pact={p}
                dense={density === 'compact'}
                walletConnected={connected}
                busyAction={actions.busyId === p.pda.toBase58() ? actions.busyAction : null}
                onFund={actions.runFund}
                onFinalize={actions.runFinalize}
                clearTopBanner={actions.clearTxState}
                onDistributed={refresh}
                media={media.get(p.pda.toBase58())}
                onMediaUpdated={refreshMedia}
              />
            </FadeInUp>
          ))}
        </section>
      ) : (
        <section
          aria-label={t('pacts.listAria')}
          className={
            'grid gap-3 ' +
            (viewMode === 'compact'
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')
          }
        >
          {paged.map((p) => (
            <FadeInUp key={p.pda.toBase58()}>
              <PactTile pact={p} media={media.get(p.pda.toBase58())} size={viewMode} />
            </FadeInUp>
          ))}
        </section>
      )}

      {/* Pagination — seulement en grille/vignettes (voir `paged` ci-dessus),
          même pattern que Marketplace (numéros cliquables). */}
      {viewMode !== 'list' && totalPages > 1 && (
        <FadeInUp>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-ink-300 transition hover:text-white disabled:opacity-40"
            >
              {t('marketplace.prevPage')}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? 'page' : undefined}
                className={
                  'h-7 w-7 rounded-md border text-xs transition ' +
                  (n === currentPage
                    ? 'border-accent-violet/60 bg-violet-500/20 text-white'
                    : 'border-white/10 text-ink-300 hover:text-white')
                }
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-ink-300 transition hover:text-white disabled:opacity-40"
            >
              {t('marketplace.nextPage')}
            </button>
          </div>
        </FadeInUp>
      )}
    </div>
    </DashboardLayout>

    {showCreate && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto">
          <CreatePactWizard
            onClose={() => setShowCreate(false)}
            onSuccess={() => {
              setShowCreate(false);
              refresh();
              refreshMedia();
            }}
          />
        </div>
      </div>
    )}
    </>
  );
}

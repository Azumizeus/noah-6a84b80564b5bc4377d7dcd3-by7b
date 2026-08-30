// src/pages/MarketplacePage.tsx
// ═══════════════════════════════════════════════════════════════════
// Onglet "/marketplace" — vue découverte. Aucune action on-chain ici :
// les cards renvoient vers la fiche publique du pact, et "Postuler"
// ouvre une candidature 100% off-chain (Supabase). Voir ApplyModal.
// ═══════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProjects } from '../hooks/useProjects';
import { useProjectMedia } from '../hooks/useProjectMedia';
import { useOpenRoles } from '../hooks/useOpenRoles';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { ChainPact } from '../lib/pacts';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import { MarketplaceCard } from '../components/MarketplaceCard';
import StatsCard from '../components/StatsCard';
import EmptyState from '../components/EmptyState';
import ApplyModal from '../components/ApplyModal';
import ReorderableSection from '../components/ReorderableSection';
import { useSectionOrder } from '../hooks/useSectionOrder';
import { useProjectCreatedAt } from '../hooks/useProjectCreatedAt';
import { MAX_MEMBERS } from '../lib/constants';
import InfoTooltip from '../components/InfoTooltip';
import ComparePactsModal from '../components/ComparePactsModal';
import PactTile from '../components/PactTile';
import ViewModeSwitch from '../components/ViewModeSwitch';
import { useViewMode } from '../hooks/useViewMode';

type Filter = 'all' | 'recruiting' | 'funding';
type SortKey = 'default' | 'recent' | 'available';

const PER_PAGE_KEY = 'buildpact_marketplace_per_page';
const PER_PAGE_OPTIONS = [6, 12, 24] as const;
function loadPerPage(): number {
  try {
    const raw = Number(localStorage.getItem(PER_PAGE_KEY));
    return (PER_PAGE_OPTIONS as readonly number[]).includes(raw) ? raw : 12;
  } catch {
    return 12;
  }
}

interface Props {
  // Optionnel : en amont (repo GitHub) la page ne prend aucune prop. Repli
  // local tant que la version amont n'est pas rapatriée, sinon App.tsx (qui
  // rend <MarketplacePage /> sans prop) ne compile pas.
  onCreatePact?: () => void;
}

export default function MarketplacePage({ onCreatePact }: Props) {
  const createPact = onCreatePact ?? (() => { window.location.hash = '#/pacts'; });
  const { t } = useLanguage();
  const { publicKey } = useWallet();
  // Réordonnancement (29/08, soir) : bloc "stats" et bloc "browse" (filtres
  // + résultats) peuvent s'inverser. Le header (titre) reste fixe — c'est
  // l'identité de la page, pas une section de contenu.
  const sectionOrder = useSectionOrder('marketplace', publicKey?.toBase58() ?? null, ['stats', 'browse'] as const);
  const { pacts, loading, error } = useProjects();
  const { media } = useProjectMedia();
  const { openRoles } = useOpenRoles();
  const [filter, setFilter] = useState<Filter>('all');
  const [applyTo, setApplyTo] = useState<ChainPact | null>(null);
  // Tri + pagination (29/08, soir) — voir useProjectCreatedAt pour la
  // source de la date (pas de champ date on-chain, voir ce fichier).
  const [sort, setSort] = useState<SortKey>('default');
  const [perPage, setPerPage] = useState<number>(() => loadPerPage());
  const [page, setPage] = useState(1);
  // Vue liste/grille/vignettes (30/08) — réglage PARTAGÉ avec Pacts (même
  // clé localStorage, voir hooks/useViewMode.ts) : changer le mode ici le
  // change aussi là-bas, c'est une préférence de lecture, pas une config
  // par page.
  const [viewMode, setViewMode] = useViewMode();
  const createdAt = useProjectCreatedAt();

  // Filtres avancés (29/08, nuit) — combinables entre eux, en plus du
  // filtre statut + tri déjà en place. Repliés par défaut pour ne pas
  // surcharger la vue par défaut de la Marketplace.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [vaultMin, setVaultMin] = useState<string>('');
  const [vaultMax, setVaultMax] = useState<string>('');
  const [minSlots, setMinSlots] = useState<number>(0);

  // Liste des compétences distinctes recherchées, dérivée d'openRoles
  // (déjà chargé pour l'affichage des cards) — pas de nouvelle requête.
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    openRoles.forEach((roles) => roles.forEach((r) => set.add(r)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [openRoles]);

  const hasAdvancedFilters =
    skillFilter !== 'all' || vaultMin !== '' || vaultMax !== '' || minSlots > 0;

  const resetAdvanced = () => {
    setSkillFilter('all');
    setVaultMin('');
    setVaultMax('');
    setMinSlots(0);
    setPage(1);
  };

  // Comparateur (29/08, nuit) — 2 à 3 pacts, sélection par PDA (string)
  // pour rester stable même si la liste `pacts` se recharge (nouvelles
  // instances d'objet) entre deux polls.
  const MAX_COMPARE = 3;
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const toggleCompare = (pact: ChainPact) => {
    const id = pact.pda.toBase58();
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_COMPARE ? ids : [...ids, id]
    );
  };
  const comparePacts = pacts.filter((p) => compareIds.includes(p.pda.toBase58()));

  // "Recrute" = pact encore ouvert (parts modifiables, membres ajoutables).
  // "Cherche des fonds" = pact finalisé, verrouillé, prêt à recevoir du SOL.
  const recruiting = pacts.filter((p) => p.status !== 'active');
  const funding = pacts.filter((p) => p.status === 'active');

  const filtered = (
    filter === 'recruiting' ? recruiting : filter === 'funding' ? funding : pacts
  ).filter((p) => {
    if (skillFilter !== 'all' && !(openRoles.get(p.pda.toBase58()) ?? []).includes(skillFilter)) {
      return false;
    }
    const min = vaultMin === '' ? null : Number(vaultMin);
    const max = vaultMax === '' ? null : Number(vaultMax);
    if (min !== null && !Number.isNaN(min) && p.vaultBalanceSol < min) return false;
    if (max !== null && !Number.isNaN(max) && p.vaultBalanceSol > max) return false;
    if (minSlots > 0 && Math.max(0, MAX_MEMBERS - p.members.length) < minSlots) return false;
    return true;
  });

  const visible = [...filtered].sort((a, b) => {
    if (sort === 'recent') {
      const da = createdAt.get(a.pda.toBase58()) ?? '';
      const db = createdAt.get(b.pda.toBase58()) ?? '';
      return db.localeCompare(da); // plus récent d'abord ; '' (inconnu) retombe en fin
    }
    if (sort === 'available') {
      // "Disponible" = recrute encore (status !== 'active') — mêmes deux
      // catégories que les filtres, juste utilisées ici pour trier plutôt
      // que pour exclure.
      const aOpen = a.status !== 'active' ? 0 : 1;
      const bOpen = b.status !== 'active' ? 0 : 1;
      return aOpen - bOpen;
    }
    return 0; // 'default' — ordre de useProjects(), inchangé
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = visible.slice((currentPage - 1) * perPage, currentPage * perPage);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };
  const changeSort = (s: SortKey) => {
    setSort(s);
    setPage(1);
  };
  const changeSkillFilter = (s: string) => {
    setSkillFilter(s);
    setPage(1);
  };
  const changeVaultMin = (v: string) => {
    setVaultMin(v);
    setPage(1);
  };
  const changeVaultMax = (v: string) => {
    setVaultMax(v);
    setPage(1);
  };
  const changeMinSlots = (n: number) => {
    setMinSlots(n);
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
    { id: 'all', label: t('marketplace.filterAll') },
    { id: 'recruiting', label: t('marketplace.filterRecruiting') },
    { id: 'funding', label: t('marketplace.filterFunding') },
  ];

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
    <div className="space-y-8">
      <FadeInUp>
        <header>
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent-neon">
            {t('marketplace.eyebrow')}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            {t('marketplace.titleLine1')}{' '}
            <span className="text-accent-violet">{t('marketplace.titleLine2')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-ink-300">{t('marketplace.subtitle')}</p>
        </header>
      </FadeInUp>

      {sectionOrder.order.map((key) => key === 'stats' ? (
        <FadeInUp key="stats">
          <ReorderableSection
            canMoveUp={!sectionOrder.isFirst('stats')}
            canMoveDown={!sectionOrder.isLast('stats')}
            onMoveUp={() => sectionOrder.moveUp('stats')}
            onMoveDown={() => sectionOrder.moveDown('stats')}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <StatsCard
                label={t('marketplace.statRecruitingLabel')}
                value={recruiting.length}
                decimals={0}
                icon="pacts"
                accent="violet"
                loading={loading}
                sublabel={t('marketplace.statRecruitingSublabel')}
              />
              <StatsCard
                label={t('marketplace.statFundingLabel')}
                value={funding.length}
                decimals={0}
                icon="earned"
                accent="neon"
                loading={loading}
                sublabel={t('marketplace.statFundingSublabel')}
              />
            </div>
          </ReorderableSection>
        </FadeInUp>
      ) : (
      <ReorderableSection
        key="browse"
        canMoveUp={!sectionOrder.isFirst('browse')}
        canMoveDown={!sectionOrder.isLast('browse')}
        onMoveUp={() => sectionOrder.moveUp('browse')}
        onMoveDown={() => sectionOrder.moveDown('browse')}
      >
      <div className="space-y-8">
      <FadeInUp>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => changeFilter(f.id)}
                className={
                  'rounded-full border px-4 py-1.5 text-xs transition-colors ' +
                  (filter === f.id
                    ? 'border-accent-violet/60 bg-violet-500/20 text-white'
                    : 'border-white/10 text-ink-300 hover:text-white')
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tri + pagination (29/08, soir) — regroupés à droite des filtres,
              même rangée sur desktop, repasse en dessous sur mobile (flex-wrap). */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
            <ViewModeSwitch value={viewMode} onChange={setViewMode} />
            <label className="flex items-center gap-1.5">
              {t('marketplace.sortLabel')}
              <select
                value={sort}
                onChange={(e) => changeSort(e.target.value as SortKey)}
                className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-white"
              >
                <option value="default">{t('marketplace.sortDefault')}</option>
                <option value="recent">{t('marketplace.sortRecent')}</option>
                <option value="available">{t('marketplace.sortAvailable')}</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
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
          </div>
        </div>

        {/* Filtres avancés (29/08, nuit) — repliés par défaut, combinables
            avec le filtre statut + tri ci-dessus. Le bouton indique le
            nombre actif via un point coloré plutôt qu'un compteur, plus
            léger visuellement pour 3 critères max. */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-300 transition hover:text-white"
          >
            <span
              className={
                'h-1.5 w-1.5 rounded-full ' +
                (hasAdvancedFilters ? 'bg-accent-neon' : 'bg-white/20')
              }
              aria-hidden="true"
            />
            {advancedOpen ? t('marketplace.advancedToggleHide') : t('marketplace.advancedToggle')}
          </button>

          {advancedOpen && (
            <div className="mt-3 flex flex-wrap items-end gap-4 rounded-xl border border-white/10 bg-black/20 p-3.5">
              <label className="flex flex-col gap-1 text-[11px] text-ink-300">
                <span className="flex items-center gap-1.5">
                  {t('marketplace.advancedSkillLabel')}
                  <InfoTooltip text={t('marketplace.advancedHint')} />
                </span>
                <select
                  value={skillFilter}
                  onChange={(e) => changeSkillFilter(e.target.value)}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white"
                >
                  <option value="all">{t('marketplace.advancedSkillAny')}</option>
                  {allSkills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1 text-[11px] text-ink-300">
                <span>{t('marketplace.advancedVaultLabel')}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={vaultMin}
                    onChange={(e) => changeVaultMin(e.target.value)}
                    placeholder={t('marketplace.advancedVaultMin')}
                    className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white"
                  />
                  <span className="text-ink-500">–</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={vaultMax}
                    onChange={(e) => changeVaultMax(e.target.value)}
                    placeholder={t('marketplace.advancedVaultMax')}
                    className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white"
                  />
                </div>
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-ink-300">
                <span>{t('marketplace.advancedSlotsLabel')}</span>
                <select
                  value={minSlots}
                  onChange={(e) => changeMinSlots(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white"
                >
                  <option value={0}>{t('marketplace.advancedSlotsAny')}</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {t('marketplace.advancedSlotsAtLeast', { n })}
                    </option>
                  ))}
                </select>
              </label>

              {hasAdvancedFilters && (
                <button
                  type="button"
                  onClick={resetAdvanced}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 transition hover:text-white"
                >
                  {t('marketplace.advancedReset')}
                </button>
              )}
            </div>
          )}
        </div>
      </FadeInUp>

      {error && (
        <FadeInUp>
          <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            {t('common.rpcErrorPrefix')} {error}
          </p>
        </FadeInUp>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="skeleton h-64 w-full rounded-2xl" aria-hidden="true" />
          <div className="skeleton h-64 w-full rounded-2xl" aria-hidden="true" />
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <FadeInUp>
          <EmptyState
            title={t('marketplace.emptyTitle')}
            description={t('marketplace.emptyDesc')}
            ctaLabel={t('marketplace.emptyCta')}
            onCta={createPact}
          />
        </FadeInUp>
      )}

      {viewMode === 'list' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {paged.map((p) => (
            <FadeInUp key={p.pda.toBase58()}>
              <MarketplaceCard
                pact={p}
                onApply={setApplyTo}
                media={media.get(p.pda.toBase58())}
                openRoles={openRoles.get(p.pda.toBase58())}
                compareSelected={compareIds.includes(p.pda.toBase58())}
                onToggleCompare={toggleCompare}
                compareDisabled={compareIds.length >= MAX_COMPARE}
              />
            </FadeInUp>
          ))}
        </div>
      ) : (
        <div
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
        </div>
      )}

      {/* Sélecteur de page (29/08, soir) — n'apparaît que s'il y a plus
          d'une page, pour ne pas polluer une petite liste. Numéros
          cliquables directement plutôt qu'un simple prev/next : plus
          rapide pour sauter loin dans une longue liste. */}
      {totalPages > 1 && (
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

      {applyTo && (
        <ApplyModal
          projectPda={applyTo.pda.toBase58()}
          projectTitle={applyTo.title}
          wantedRoles={openRoles.get(applyTo.pda.toBase58())}
          onClose={() => setApplyTo(null)}
        />
      )}
      </div>
      </ReorderableSection>
      ))}

      {/* Barre flottante du comparateur — visible dès qu'au moins 1 pact
          est coché, le bouton "Comparer" ne s'active qu'à partir de 2. */}
      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="modal-surface flex items-center gap-3 rounded-full border border-white/10 px-4 py-2.5 shadow-xl">
            <span className="text-xs text-ink-200">
              {t('compare.barLabel', { n: compareIds.length })}
            </span>
            {compareIds.length < 2 && (
              <span className="text-[11px] text-ink-500">{t('compare.barMin')}</span>
            )}
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-ink-300 transition hover:text-white"
            >
              {t('compare.barClear')}
            </button>
            <button
              type="button"
              disabled={compareIds.length < 2}
              onClick={() => setCompareOpen(true)}
              className="rounded-full bg-accent-violet px-3.5 py-1 text-[11px] font-bold text-ink-900 transition hover:bg-accent-violet/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('compare.barButton')}
            </button>
          </div>
        </div>
      )}

      {compareOpen && comparePacts.length >= 2 && (
        <ComparePactsModal
          pacts={comparePacts}
          openRoles={openRoles}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
    </DashboardLayout>
  );
}

// src/components/MarketplaceCard.tsx
// ═══════════════════════════════════════════════════════════════════
// Card de découverte — pitch nettoyé, % restant / rôles ouverts pour les
// projets Open, montant financé pour les Finalized. C'est la vue
// "investisseur/candidat" ; les actions on-chain (approve/fund/finalize/
// distribute) restent sur la fiche publique #/pact/:pda (PactCard).
// ═══════════════════════════════════════════════════════════════════
import { useWallet } from '@solana/wallet-adapter-react';
import type { ChainPact } from '../lib/pacts';
import { formatAddress, formatSol } from '../lib/pacts';
import { parsePitch, stageBadgeLabel } from '../lib/pitch';
import type { ProjectMedia } from '../lib/media';
import { useLanguage } from '../lib/i18n/LanguageContext';
import ImageHoverPreview from './ImageHoverPreview';

interface Props {
  pact: ChainPact;
  onApply: (pact: ChainPact) => void;
  media?: ProjectMedia;
  openRoles?: string[]; // rôles recherchés (off-chain) — absents sur les anciens pacts
  // Comparateur (29/08, nuit) — tous optionnels : une card sans ces props
  // (ex. ancien usage ailleurs dans l'app) se comporte exactement comme
  // avant, aucune case ne s'affiche.
  compareSelected?: boolean;
  onToggleCompare?: (pact: ChainPact) => void;
  compareDisabled?: boolean; // sélection déjà au maximum, et cette card n'en fait pas partie
}
const SHARE_COLORS = ['#8B5CF6', '#34D399', '#F59E0B', '#EC4899', '#3B82F6', '#EF4444'];

// Dégradé de secours déterministe (même projet = même dégradé à chaque rendu)
// quand aucune bannière n'a été uploadée — évite les cards "vides".
// Bande de teintes restreinte à vert↔violet (150°-290°) — couvre les
// accents de marque (neon ≈152°, violet ≈262°) au lieu du cercle complet
// 0-360°, qui pouvait tomber sur du rouge/orange/jaune hors charte.
// Déterminisme par PDA inchangé : même seed → même dégradé à chaque rendu.
const BANNER_HUE_MIN = 150;
const BANNER_HUE_RANGE = 140; // 150 → 290

export function fallbackBannerStyle(seed: string): React.CSSProperties {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue1 = BANNER_HUE_MIN + (hash % BANNER_HUE_RANGE);
  const hue2 = BANNER_HUE_MIN + ((hash >> 8) % BANNER_HUE_RANGE);
  return { background: `linear-gradient(135deg, hsl(${hue1} 70% 22%), hsl(${hue2} 70% 14%))` };
}

export function MarketplaceCard({
  pact,
  onApply,
  media,
  openRoles,
  compareSelected,
  onToggleCompare,
  compareDisabled,
}: Props) {
  const { publicKey } = useWallet();
  const { t } = useLanguage();
  const parsed = parsePitch(pact.description);
  const pitchText = parsed.pitch || pact.description;

  const totalBps = pact.members.reduce((sum, m) => sum + m.shareBps, 0);
  const pctAllocated = totalBps / 100;
  const pctRemaining = Math.max(0, 100 - pctAllocated);

  const isOpen = pact.status !== 'active';
  const myAddr = publicKey?.toBase58();
  const iAmMember = pact.members.some((m) => m.wallet.toBase58() === myAddr);

  return (
    <article className="glass-panel card-lift flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 p-6">
      {media?.bannerUrl ? (
        <div className="-mx-6 -mt-6 mb-4 h-24 w-[calc(100%+3rem)]">
          <ImageHoverPreview src={media.bannerUrl} alt={pact.title} kind="banner" className="h-full w-full">
            <img src={media.bannerUrl} alt="" className="h-full w-full object-cover" />
          </ImageHoverPreview>
        </div>
      ) : (
        <div
          className="-mx-6 -mt-6 mb-4 flex h-24 w-[calc(100%+3rem)] items-center justify-center"
          style={fallbackBannerStyle(pact.pda.toBase58())}
          aria-hidden="true"
        >
          <span className="font-mono text-2xl font-bold text-white/20">
            {pact.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {media?.logoUrl && (
            <ImageHoverPreview src={media.logoUrl} alt={pact.title} kind="logo" className="shrink-0">
              <img
                src={media.logoUrl}
                alt=""
                className="h-9 w-9 rounded-lg object-cover ring-1 ring-white/10"
              />
            </ImageHoverPreview>
          )}
          <h3 className="line-clamp-2 font-sans text-lg font-semibold text-white">{pact.title}</h3>
        </div>
        <span
          className={
            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ' +
            (isOpen
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400')
          }
        >
          {isOpen ? t('marketplaceCard.recruiting') : t('marketplaceCard.funding')}
        </span>
      </div>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-ink-300">
        {pitchText.length > 180 ? pitchText.slice(0, 180) + '…' : pitchText}
      </p>

      {isOpen ? (
        <div className="mb-4 space-y-2">
          {parsed.stage && (
            <span className="inline-block rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-accent-violet">
              {stageBadgeLabel(parsed.stage)}
            </span>
          )}
          {/* Rôles RECHERCHÉS (off-chain, déclarés par le founder) — l'info
              clé pour un candidat. Les anciens pacts n'en ont pas : on tombe
              alors sur la ligne "rôles du founder" ci-dessous, inchangée. */}
          {openRoles && openRoles.length > 0 && (
            <p className="text-xs text-ink-400">
              <span className="text-accent-neon">{t('marketplaceCard.lookingFor')}</span>{openRoles.join(' · ')}
            </p>
          )}
          {parsed.rolesWanted && (
            <p className="text-xs text-ink-400">
              <span className="text-ink-300">{t('marketplaceCard.rolesWanted')}</span>{parsed.rolesWanted}
            </p>
          )}
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-400">
              <span>{t('marketplaceCard.allocated', { n: pctAllocated.toFixed(0) })}</span>
              <span className="text-accent-neon">{t('marketplaceCard.remaining', { n: pctRemaining.toFixed(0) })}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent-violet"
                style={{
                  width: `${Math.min(100, pctAllocated)}%`,
                  boxShadow: '0 0 8px 1px rgb(var(--accent-violet-rgb) / 0.55)',
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
          <div>
            <p className="text-[11px] text-ink-400">{t('marketplaceCard.vault')}</p>
            <p className="font-mono text-sm font-bold text-white">{formatSol(pact.vaultBalanceSol)} SOL</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-400">{t('marketplaceCard.members')}</p>
            <p className="font-mono text-sm font-bold text-white">{pact.members.length}</p>
          </div>
        </div>
      )}

      <p className="mb-4 font-mono text-[11px] text-ink-500">
        {t('marketplaceCard.creator')}{formatAddress(pact.creator.toBase58())}
      </p>

      {onToggleCompare && (
        <label
          className={
            'mb-3 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ' +
            (compareSelected
              ? 'border-accent-neon/50 bg-accent-neon/10 text-accent-neon'
              : 'border-white/10 text-ink-400 hover:text-white') +
            (compareDisabled && !compareSelected ? ' cursor-not-allowed opacity-40' : ' cursor-pointer')
          }
        >
          <input
            type="checkbox"
            checked={Boolean(compareSelected)}
            disabled={compareDisabled && !compareSelected}
            onChange={() => onToggleCompare(pact)}
            className="h-3 w-3 rounded border-white/20 bg-black/30 accent-accent-neon"
          />
          {t('marketplaceCard.compare')}
        </label>
      )}

      <div className="mt-auto flex gap-2">
        <a
          href={`#/pact/${pact.pda.toBase58()}`}
          className="flex-1 rounded-lg border border-white/10 py-2 text-center text-sm text-ink-300 transition hover:border-accent-violet/40 hover:text-white"
        >
          {t('marketplaceCard.viewSheet')}
        </a>
        {isOpen && !iAmMember && (
          <button
            type="button"
            onClick={() => onApply(pact)}
            className="flex-1 rounded-lg bg-accent-violet py-2 text-sm font-medium text-ink-900 transition hover:bg-accent-violet/90"
          >
            {t('marketplaceCard.apply')}
          </button>
        )}
      </div>
                {pact.members.length > 0 && (
            <div className="mb-4">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                {pact.members.map((m, i) => (
                  <div
                    key={m.wallet.toBase58()}
                    style={{
                      width: `${m.shareBps / 100}%`,
                      background: SHARE_COLORS[i % SHARE_COLORS.length],
                      boxShadow: `0 0 6px 0 ${SHARE_COLORS[i % SHARE_COLORS.length]}80`,
                    }}
                    title={`${formatAddress(m.wallet.toBase58())} · ${(m.shareBps / 100).toFixed(1)}%`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-ink-500">
                {pact.members.slice(0, 3).map((m) => `${formatAddress(m.wallet.toBase58())} ${(m.shareBps / 100).toFixed(0)}%`).join(' · ')}
                {pact.members.length > 3 ? '…' : ''}
              </p>
            </div>
          )}
    </article>
  );
}

export default MarketplaceCard;

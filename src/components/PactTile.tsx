// src/components/PactTile.tsx
// ═══════════════════════════════════════════════════════════════════
// Card compacte pour les vues "grille" et "vignettes" (30/08, voir
// hooks/useViewMode.ts) — utilisée sur Pacts ET Marketplace, pour un
// comportement cohérent entre les deux listes. Complète PactCard (vue
// "liste", détaillée, actions on-chain incluses) et MarketplaceCard (vue
// découverte) sans les remplacer : celles-ci restent la vue par défaut,
// PactTile est l'alternative plus dense.
//
// Toujours un simple lien vers la fiche publique (#/pact/:pda) — aucune
// action on-chain ici, ce serait trop à caser dans une carte de cette
// taille. `size="compact"` (vignette) réduit encore la bannière et cache
// la description ; `size="grid"` garde un peu plus de respiration.
// ═══════════════════════════════════════════════════════════════════
import type { ChainPact } from '../lib/pacts';
import { formatSol } from '../lib/pacts';
import type { ProjectMedia } from '../lib/media';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { fallbackBannerStyle } from './MarketplaceCard';

interface Props {
  pact: ChainPact;
  media?: ProjectMedia;
  size: 'grid' | 'compact';
}

export function PactTile({ pact, media, size }: Props) {
  const { t } = useLanguage();
  const isOpen = pact.status !== 'active';
  const bannerH = size === 'compact' ? 'h-16' : 'h-24';

  return (
    <a
      href={`#/pact/${pact.pda.toBase58()}`}
      className="glass-panel card-lift flex h-full flex-col overflow-hidden rounded-xl border border-white/5"
    >
      {media?.bannerUrl ? (
        <img src={media.bannerUrl} alt="" className={`${bannerH} w-full object-cover`} />
      ) : (
        <div
          className={`flex ${bannerH} w-full items-center justify-center`}
          style={fallbackBannerStyle(pact.pda.toBase58())}
          aria-hidden="true"
        >
          <span className="font-mono text-lg font-bold text-white/20">
            {pact.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className={size === 'compact' ? 'space-y-1.5 p-2.5' : 'space-y-2 p-3.5'}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-xs font-semibold text-white">{pact.title}</h3>
          <span
            className={
              'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ' +
              (isOpen
                ? 'bg-accent-gold/15 text-accent-gold'
                : 'bg-accent-neon/15 text-accent-neon')
            }
          >
            {isOpen ? t('marketplace.filterRecruiting') : t('marketplace.filterFunding')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-ink-400">
          <span>{formatSol(pact.vaultBalanceSol)} SOL</span>
          <span>{pact.members.length} {t('pacts.membersShort')}</span>
        </div>
      </div>
    </a>
  );
}

export default PactTile;

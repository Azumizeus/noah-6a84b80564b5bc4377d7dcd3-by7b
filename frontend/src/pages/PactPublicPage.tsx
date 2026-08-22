// src/pages/PactPublicPage.tsx
// ═══════════════════════════════════════════════════════════════════
// Fiche projet publique — #/pact/:pda
// Pensée pour un juge qui clique un lien : rôles/parts/statut visibles
// SANS connecter de wallet (usePublicPact() utilise getReadonlyProgram()).
// Si un wallet EST connecté, les actions habituelles (approuver, financer,
// finaliser, distribuer) restent disponibles via PactCard — bonus, pas requis.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';
import QrCode from '../components/QrCode';
import ActivityFeed from '../components/ActivityFeed';
import VideoEmbed from '../components/VideoEmbed';
import UpdatesFeed from '../components/UpdatesFeed';
import ChatBox from '../components/ChatBox';
import VaultPanel from '../components/VaultPanel';
import { usePublicPact, usePactActions } from '../hooks/useProjects';
import { pactPublicUrl, useVaultDocParam } from '../lib/router';
import { fetchProjectMedia, type ProjectMedia } from '../lib/media';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { markSeenNow } from '../lib/seen';

interface Props {
  pda: string;
}

export function PactPublicPage({ pda }: Props) {
  const { connected } = useWallet();
  const { t } = useLanguage();
  const { pact, loading, error } = usePublicPact(pda);
  const focusDocId = useVaultDocParam();

  // Marque le chat "vu" dès qu'on affiche cette fiche (lecture publique,
  // pas besoin de signature) — fait disparaître le badge "nouveau message"
  // de la liste des pacts. Le vault, lui, se marque vu à l'unlock (signature
  // requise) — voir onVaultUnlocked plus bas.
  useEffect(() => {
    if (pda) markSeenNow('chat', pda);
  }, [pda]);
  // Refresh simple : la page publique n'a pas de liste à rafraîchir,
  // on recharge la fiche via un reload — cohérent avec PactCard ailleurs.
  const { busyId, busyAction, runFund, runFinalize } = usePactActions(() => window.location.reload());
  const [copied, setCopied] = useState(false);
  const [media, setMedia] = useState<ProjectMedia | undefined>(undefined);

  const refreshMedia = useCallback(() => {
    fetchProjectMedia(pda).then((m) => setMedia(m ?? undefined));
  }, [pda]);

  useEffect(() => {
    refreshMedia();
  }, [refreshMedia]);

  const shareUrl = pactPublicUrl(pda);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible (contexte non sécurisé, permission refusée...) — non bloquant */
    }
  };

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">{t('publicPact.eyebrow')}</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('publicPact.titleLine1')} <span className="text-accent-violet">{t('publicPact.titleLine2')}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            {t('publicPact.subtitle')}
          </p>
        </header>
      </FadeInUp>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass-panel h-64 animate-pulse rounded-2xl lg:col-span-2" aria-hidden="true" />
          <div className="glass-panel h-64 animate-pulse rounded-2xl" aria-hidden="true" />
        </div>
      ) : error || !pact ? (
        <FadeInUp>
          <EmptyState
            title={t('publicPact.notFoundTitle')}
            description={t('publicPact.notFoundDesc', { error: error ?? '' })}
            ctaLabel={t('publicPact.notFoundCta')}
            onCta={() => { window.location.hash = '#/pacts'; }}
          />
        </FadeInUp>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {media?.pitchVideoUrl && (
              <FadeInUp>
                <VideoEmbed url={media.pitchVideoUrl} />
              </FadeInUp>
            )}
            <FadeInUp>
              <PactCard
                pact={pact}
                walletConnected={connected}
                busyAction={busyId === pact.pda.toBase58() ? busyAction : null}
                onFund={runFund}
                onFinalize={runFinalize}
                media={media}
                onMediaUpdated={refreshMedia}
                showOpenSheetButton={false}
              />
            </FadeInUp>
          </div>

          <div className="space-y-4">
            <FadeInUp>
              <div className="glass-panel p-4 text-center">
                <h3 className="mb-3 font-sans text-sm font-semibold text-white">{t('publicPact.shareHeading')}</h3>
                <div className="mx-auto w-fit rounded-xl bg-white p-3">
                  <QrCode value={shareUrl} size={148} />
                </div>
                <p className="mt-2 text-[11px] text-ink-400">
                  {t('publicPact.scanHint')}
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-ink-300 transition hover:border-accent-violet/40 hover:text-white"
                >
                  {copied ? t('common.linkCopied') : t('common.copyLink')}
                </button>
              </div>
            </FadeInUp>

            <FadeInUp>
              <VaultPanel
                projectPda={pact.pda.toBase58()}
                members={pact.members}
                creatorWallet={pact.creator.toBase58()}
                focusDocId={focusDocId}
                onUnlocked={() => markSeenNow('vault', pact.pda.toBase58())}
              />
            </FadeInUp>

            <FadeInUp>
              <ChatBox projectPda={pact.pda.toBase58()} />
            </FadeInUp>

            <FadeInUp>
              <UpdatesFeed projectPda={pact.pda.toBase58()} members={pact.members} />
            </FadeInUp>

            <FadeInUp>
              <ActivityFeed projectPda={pact.pda.toBase58()} />
            </FadeInUp>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default PactPublicPage;

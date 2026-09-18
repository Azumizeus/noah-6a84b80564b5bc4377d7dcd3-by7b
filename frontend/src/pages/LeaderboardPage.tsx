// src/pages/LeaderboardPage.tsx
// ═══════════════════════════════════════════════════════════════════
// Classement XP — global ou par pact — + panneau perso (XP, badges,
// quêtes de la semaine) pour le wallet connecté. Pop-up de paramètres
// (thème/mode/langue) accessible ici aussi, comme sur la page Profil.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import EmptyState from '../components/EmptyState';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import XpBar from '../components/XpBar';
import BadgeShelf from '../components/BadgeShelf';
import InfoTooltip from '../components/InfoTooltip';
import QuestBoard from '../components/QuestBoard';
import { RANK_ICON, IconRankAnon } from '../components/RankIcons';
import {
  fetchLeaderboard,
  fetchPactLeaderboard,
  computeRank,
  type LeaderboardRow,
} from '../lib/gamification';
import { useProjects } from '../hooks/useProjects';
import { formatAddress } from '../lib/pacts';
import { useLanguage } from '../lib/i18n/LanguageContext';

type Scope = 'global' | string; // 'global' ou le pda (base58) d'un pact

export default function LeaderboardPage() {
  const { t } = useLanguage();
  const { publicKey } = useWallet();
  const myAddr = publicKey?.toBase58();
  const { pacts } = useProjects();

  const [scope, setScope] = useState<Scope>('global');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // BUG FIX (29/08) : le journal de quêtes était un panneau toujours visible
  // dans la grille — l'utilisateur l'a redemandé plusieurs fois comme un
  // vrai pop-up (même logique que le bouton Paramètres ci-dessous).
  const [questsOpen, setQuestsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      const list = scope === 'global' ? await fetchLeaderboard() : await fetchPactLeaderboard(scope);
      if (!cancelled) setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  // Le pact sélectionné doit rester valide si la liste de pacts change
  // (ex. un pact ferme) — sinon le libellé du <select> resterait affiché
  // pour une option qui n'existe plus.
  const scopedPactStillExists = useMemo(
    () => scope === 'global' || pacts.some((p) => p.pda.toBase58() === scope),
    [scope, pacts]
  );
  useEffect(() => {
    if (!scopedPactStillExists) setScope('global');
  }, [scopedPactStillExists]);

  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">
              {t('gamification.leaderboardHeading')}
            </p>
            <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('gamification.leaderboardHeading')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-300">{t('gamification.leaderboardSubtitle')}</p>
          </div>
          {publicKey && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setQuestsOpen(true)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-ink-200 transition hover:border-accent-violet/40 hover:text-white"
              >
                {t('gamification.questsButton')}
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-ink-200 transition hover:border-accent-violet/40 hover:text-white"
              >
                {t('profile.settingsButton')}
              </button>
            </div>
          )}
        </header>
      </FadeInUp>

      {publicKey && (
        <FadeInUp>
          <div className="mb-6 glass-panel p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-1.5 font-sans text-sm font-bold text-white">
              {t('gamification.sectionHeading')}
              <InfoTooltip text={t('gamification.sectionHint')} />
            </h3>
            <XpBar wallet={myAddr!} />
            <div className="mt-4">
              <BadgeShelf wallet={myAddr!} />
            </div>
          </div>
        </FadeInUp>
      )}

      <FadeInUp>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScope('global')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              scope === 'global'
                ? 'border-accent-violet/40 bg-accent-violet/15 text-white'
                : 'border-white/10 bg-black/20 text-ink-300 hover:text-white'
            }`}
          >
            {t('gamification.leaderboardScopeGlobal')}
          </button>
          {pacts.length > 0 && (
            <select
              value={scope === 'global' ? '' : scope}
              onChange={(e) => setScope(e.target.value || 'global')}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-ink-200 outline-none transition focus:border-accent-violet/40"
            >
              <option value="">{t('gamification.leaderboardScopePact')}...</option>
              {pacts.map((p) => (
                <option key={p.pda.toBase58()} value={p.pda.toBase58()}>
                  {p.title || formatAddress(p.pda.toBase58())}
                </option>
              ))}
            </select>
          )}
        </div>
      </FadeInUp>

      <FadeInUp>
        {rows === null ? (
          <div className="glass-panel h-64 animate-pulse rounded-2xl" aria-hidden="true" />
        ) : rows.length === 0 ? (
          <EmptyState title={t('gamification.leaderboardHeading')} description={t('gamification.leaderboardEmpty')} />
        ) : (
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-3 font-medium">{t('gamification.leaderboardRankCol')}</th>
                    <th className="px-4 py-3 font-medium">{t('gamification.leaderboardWalletCol')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('gamification.leaderboardXpCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isMe = row.wallet === myAddr;
                    const { rankKey } = computeRank(row.xp);
                    return (
                      <tr
                        key={row.wallet}
                        className={`border-b border-white/5 last:border-0 ${isMe ? 'bg-accent-violet/10' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-ink-300">#{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-mono text-ink-200">
                            {(() => {
                              const Icon = RANK_ICON[rankKey] ?? IconRankAnon;
                              return <Icon className="h-3 w-3 shrink-0" />;
                            })()}
                            {formatAddress(row.wallet)}
                            {isMe && <span className="text-ink-500">{t('gamification.leaderboardYou')}</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-white">{row.xp}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </FadeInUp>

      {settingsOpen && <ProfileSettingsModal onClose={() => setSettingsOpen(false)} />}

      {questsOpen && publicKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('gamification.questsHeading')}
          onClick={() => setQuestsOpen(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuestsOpen(false)}
                aria-label={t('profile.settingsClose')}
                className="absolute -top-2 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-canvas-800 text-ink-300 transition hover:text-white"
              >
                ✕
              </button>
              <QuestBoard wallet={myAddr!} />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

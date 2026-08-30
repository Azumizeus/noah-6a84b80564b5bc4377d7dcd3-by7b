// src/components/QuestBoard.tsx
// ═══════════════════════════════════════════════════════════════════
// Journal de quêtes V2 (29/08) — 3 quêtes hebdomadaires fixes (fund/
// approve/finalize), mais avec ce qui manquait pour que ça se sente comme
// un vrai journal plutôt qu'une jauge :
//   - clic de réclamation (le geste crée l'habitude, pas le crédit auto) ;
//   - série (streak) de semaines consécutives complètes ;
//   - bonus de complétion quand les 3 sont réclamées la même semaine ;
//   - un onglet Chronique qui relit pact_events comme un historique, pas
//     juste une case à cocher.
// Le calcul de progression reste public/côté client (fetchWeeklyQuestProgress),
// mais la RÉCLAMATION revérifie tout côté serveur (quest-write) — voir
// lib/gamification.ts pour le détail des garanties.
//
// Refonte "premium fun" (29/08, soir suivant, sur demande explicite) :
//   - icônes SVG custom (QuestIcons.tsx) à la place des emoji Unicode ;
//   - éclat de particules (ClaimBurst.tsx) à la réclamation réussie ;
//   - aperçu de récompense ("+N XP") affiché AVANT que la quête soit
//     faite, pas seulement sur le bouton une fois débloqué ;
//   - série hebdomadaire en pastilles plutôt qu'un simple nombre.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  fetchWeeklyQuestProgress,
  fetchClaimedThisWeek,
  fetchQuestStreak,
  fetchWalletChronicle,
  fetchQuestHistory,
  claimQuestReward,
  QUEST_KEYS,
  QUEST_CLAIM_XP,
  QUEST_BONUS_XP,
  type QuestProgress,
  type QuestKey,
  type ChronicleEntry,
  type QuestWeekHistory,
} from '../lib/gamification';
import { useLanguage } from '../lib/i18n/LanguageContext';
import {
  IconFund,
  IconApprove,
  IconFinalize,
  IconFundFilled,
  IconApproveFilled,
  IconFinalizeFilled,
  IconStreak,
  IconBonus,
  CHRONICLE_ICON,
} from './QuestIcons';
import ClaimBurst from './ClaimBurst';

interface Props {
  wallet: string;
  className?: string;
}

const QUEST_LABEL_KEY: Record<QuestKey, string> = {
  fund: 'gamification.questFund',
  approve: 'gamification.questApprove',
  finalize: 'gamification.questFinalize',
};
const QUEST_ICON: Record<QuestKey, FC<{ className?: string }>> = {
  fund: IconFund,
  approve: IconApprove,
  finalize: IconFinalize,
};
// Icônes pleines pour le badge circulaire du journal (voir QuestIcons.tsx
// — le badge fournit déjà le cercle, les variantes filled lisent mieux à
// cette taille que les contours fins réutilisés pour la Chronique).
const QUEST_BADGE_ICON: Record<QuestKey, FC<{ className?: string }>> = {
  fund: IconFundFilled,
  approve: IconApproveFilled,
  finalize: IconFinalizeFilled,
};

const CHRONICLE_LABEL_KEY: Record<string, string> = {
  create: 'gamification.chronicleCreate',
  approve: 'gamification.chronicleApprove',
  fund: 'gamification.chronicleFund',
  finalize: 'gamification.chronicleFinalize',
  distribute: 'gamification.chronicleDistribute',
  add_member: 'gamification.chronicleAddMember',
};

// Longueur de la bande de pastilles de série — purement visuel, on ne
// stocke pas d'historique semaine par semaine (seul le compteur `streak`
// existe côté serveur, voir fetchQuestStreak). Une pastille = une semaine
// de la série en cours, remplie jusqu'à `streak` (plafonné à l'affichage).
const STREAK_DOTS = 8;

export default function QuestBoard({ wallet, className = '' }: Props) {
  const { t, lang } = useLanguage();
  const { signMessage } = useWallet();
  const [tab, setTab] = useState<'quests' | 'chronicle' | 'history'>('quests');

  const [quests, setQuests] = useState<QuestProgress | null>(null);
  const [claimed, setClaimed] = useState<Set<QuestKey | 'bonus'> | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [claiming, setClaiming] = useState<QuestKey | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  // Clé de la quête qui vient d'être réclamée — pilote l'éclat de
  // particules (ClaimBurst) pendant ~650ms, indépendant de `claiming`
  // (qui, lui, ne dure que le temps de l'appel réseau).
  const [justClaimed, setJustClaimed] = useState<QuestKey | null>(null);

  const [chronicle, setChronicle] = useState<ChronicleEntry[] | null>(null);
  const [history, setHistory] = useState<QuestWeekHistory[] | null>(null);

  // Animation de "déblocage" (29/08, V3 — suite au retour "je veux voir le
  // moment où ça bascule", pas juste un état statique) : on garde la
  // complétion précédente en ref (pas en state, on ne veut pas re-render
  // pour ça) et on compare à chaque nouveau fetch. Une quête qui passe de
  // "pas faite" à "faite" (et pas encore réclamée) déclenche un flash
  // ponctuel sur son badge — distinct de l'anneau pulsant continu
  // (quest-badge-claimable), qui lui marque l'état en continu tant que la
  // quête attend d'être réclamée. `null` = pas encore de référence (tout
  // premier chargement) : on ne veut PAS animer sur le chargement initial,
  // seulement sur un vrai changement observé pendant que le panneau est ouvert.
  const prevDoneRef = useRef<Record<QuestKey, boolean> | null>(null);
  const [unlockedKey, setUnlockedKey] = useState<QuestKey | null>(null);

  const applyQuests = (next: QuestProgress) => {
    const prev = prevDoneRef.current;
    if (prev) {
      for (const key of QUEST_KEYS) {
        const wasDone = prev[key];
        const isDone = next[key].done >= next[key].target;
        if (!wasDone && isDone) {
          setUnlockedKey(key);
          window.setTimeout(() => setUnlockedKey((k) => (k === key ? null : k)), 900);
        }
      }
    }
    prevDoneRef.current = Object.fromEntries(
      QUEST_KEYS.map((key) => [key, next[key].done >= next[key].target])
    ) as Record<QuestKey, boolean>;
    setQuests(next);
  };

  const reload = () => {
    fetchWeeklyQuestProgress(wallet).then(applyQuests);
    fetchClaimedThisWeek(wallet).then(setClaimed);
    fetchQuestStreak(wallet).then(setStreak);
  };

  useEffect(() => {
    let alive = true;
    fetchWeeklyQuestProgress(wallet).then((q) => alive && applyQuests(q));
    fetchClaimedThisWeek(wallet).then((c) => alive && setClaimed(c));
    fetchQuestStreak(wallet).then((s) => alive && setStreak(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  useEffect(() => {
    if (tab !== 'chronicle' || chronicle !== null) return;
    let alive = true;
    fetchWalletChronicle(wallet).then((c) => alive && setChronicle(c));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, wallet]);

  useEffect(() => {
    if (tab !== 'history' || history !== null) return;
    let alive = true;
    fetchQuestHistory(wallet).then((h) => alive && setHistory(h));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, wallet]);

  const handleClaim = async (key: QuestKey) => {
    if (!signMessage) {
      setClaimError(t('gamification.questClaimUnsupported'));
      return;
    }
    setClaiming(key);
    setClaimError(null);
    const res = await claimQuestReward(wallet, key, signMessage);
    setClaiming(null);
    if (!res.ok) {
      setClaimError(res.error ?? t('gamification.questClaimError'));
      return;
    }
    setJustClaimed(key);
    window.setTimeout(() => setJustClaimed(null), 700);
    reload();
  };

  const claimedCount = claimed ? QUEST_KEYS.filter((k) => claimed.has(k)).length : 0;
  const bonusClaimed = claimed?.has('bonus') ?? false;

  return (
    <div className={`modal-surface p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-sans text-sm font-bold text-white">{t('gamification.questsHeading')}</h3>
        {streak !== null && streak > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2.5 py-1 text-[11px] font-semibold text-accent-gold"
            title={t('gamification.questStreak', { n: streak })}
          >
            <IconStreak className="h-3 w-3" />
            {t('gamification.questStreak', { n: streak })}
          </span>
        )}
      </div>

      {/* Série en pastilles — remplace le simple nombre par un repère visuel
          rapide, dans l'esprit "premium fun" demandé. */}
      {streak !== null && streak > 0 && (
        <div className="mb-3 flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: STREAK_DOTS }, (_, i) => i < streak).map((filled, i) => (
            <span
              key={i}
              className={
                'h-1.5 flex-1 rounded-full transition-colors ' +
                (filled ? 'bg-accent-gold' : 'bg-white/10')
              }
            />
          ))}
        </div>
      )}

      <div role="tablist" className="mb-3 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'quests'}
          onClick={() => setTab('quests')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            tab === 'quests' ? 'bg-accent-violet/20 text-white' : 'text-ink-300 hover:text-white'
          }`}
        >
          {t('gamification.questsTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chronicle'}
          onClick={() => setTab('chronicle')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            tab === 'chronicle' ? 'bg-accent-violet/20 text-white' : 'text-ink-300 hover:text-white'
          }`}
        >
          {t('gamification.chronicleTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            tab === 'history' ? 'bg-accent-violet/20 text-white' : 'text-ink-300 hover:text-white'
          }`}
        >
          {t('gamification.historyTab')}
        </button>
      </div>

      {tab === 'quests' ? (
        quests === null || claimed === null ? (
          <div className="space-y-2">
            {QUEST_KEYS.map((k) => (
              <div key={k} className="h-10 w-full animate-pulse rounded-lg bg-white/5" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {QUEST_KEYS.map((key, index) => {
                const q = quests[key];
                const done = q.done >= q.target;
                const isClaimed = claimed.has(key);
                const Icon = QUEST_BADGE_ICON[key];
                // État à 3 valeurs plutôt que 2 booléens croisés — le retour
                // "ça ne donne pas envie de participer" (29/08, V3) tenait en
                // grande partie au fait que rien ne distinguait visuellement
                // "en cours" de "prête à réclamer" à part une bordure plus
                // dorée : maintenant chaque état a son propre badge d'icône.
                const state: 'todo' | 'claimable' | 'claimed' = isClaimed ? 'claimed' : done ? 'claimable' : 'todo';
                return (
                  <li
                    key={key}
                    className={`quest-row-enter relative flex items-center justify-between gap-3 overflow-visible rounded-lg border px-3 py-2.5 text-xs transition ${
                      state === 'claimed'
                        ? 'border-accent-neon/25 bg-accent-neon/10'
                        : state === 'claimable'
                          ? 'border-accent-gold/30 bg-accent-gold/5'
                          : 'border-white/10 bg-black/20'
                    }`}
                    style={{ ['--row-delay' as string]: `${index * 90}ms` }}
                  >
                    {justClaimed === key && <ClaimBurst />}
                    <span className="inline-flex items-center gap-2.5 text-ink-200">
                      {/* Badge circulaire par état — anneau pulsant en continu
                          quand la quête attend d'être réclamée, checkmark
                          plein une fois réclamée, contour neutre sinon. */}
                      <span
                        className={
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ' +
                          (state === 'claimed'
                            ? 'border-accent-neon/40 bg-accent-neon/15 text-accent-neon'
                            : state === 'claimable'
                              ? 'quest-badge-claimable border-accent-gold/50 bg-accent-gold/15 text-accent-gold'
                              : 'border-white/15 bg-white/5 text-ink-400') +
                          (unlockedKey === key ? ' quest-badge-unlock' : '')
                        }
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-2">
                          {t(QUEST_LABEL_KEY[key])}
                          {/* Aperçu de récompense — visible dès le départ, pas
                              seulement une fois débloquée (demande explicite). */}
                          {!isClaimed && (
                            <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
                              +{QUEST_CLAIM_XP[key]} XP
                            </span>
                          )}
                        </span>
                        {/* Mini barre de progression — seulement utile quand
                            la cible dépasse 1 (quête "fund", 2 pacts) ; pour
                            une cible de 1, "0/1" est déjà l'info complète. */}
                        {state === 'todo' && q.target > 1 && (
                          <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full bg-accent-violet transition-[width]"
                              style={{ width: `${Math.min(100, (q.done / q.target) * 100)}%` }}
                            />
                          </span>
                        )}
                      </span>
                    </span>
                    {isClaimed ? (
                      <span className="font-mono text-[11px] font-semibold text-accent-neon">
                        ✓ {t('gamification.questClaimed')}
                      </span>
                    ) : done ? (
                      <button
                        type="button"
                        onClick={() => handleClaim(key)}
                        disabled={claiming === key}
                        className="rounded-md bg-accent-gold/90 px-2.5 py-1 text-[11px] font-bold text-ink-900 transition hover:bg-accent-gold disabled:opacity-50"
                      >
                        {claiming === key
                          ? t('gamification.questClaiming')
                          : t('gamification.questClaimButton', { n: QUEST_CLAIM_XP[key] })}
                      </button>
                    ) : (
                      <span className="font-mono text-[11px] text-ink-400">
                        {t('gamification.questProgress', { done: q.done, total: q.target })}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {claimError && <p className="mt-2 text-[11px] text-rose-400">{claimError}</p>}

            <div
              className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] ${
                bonusClaimed
                  ? 'border-accent-gold/30 bg-accent-gold/10 text-accent-gold'
                  : 'border-white/10 bg-black/20 text-ink-400'
              }`}
            >
              <IconBonus className={bonusClaimed ? 'h-3.5 w-3.5 shrink-0 text-accent-gold' : 'h-3.5 w-3.5 shrink-0'} />
              {bonusClaimed
                ? t('gamification.questBonusClaimed', { n: QUEST_BONUS_XP })
                : t('gamification.questBonusTeaser', { done: claimedCount, total: QUEST_KEYS.length, n: QUEST_BONUS_XP })}
            </div>
          </>
        )
      ) : chronicle === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-white/5" aria-hidden="true" />
          ))}
        </div>
      ) : chronicle.length === 0 ? (
        <p className="text-xs text-ink-400">{t('gamification.chronicleEmpty')}</p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {chronicle.map((e, i) => {
            const ChronIcon = CHRONICLE_ICON[e.kind];
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
              >
                <span className="inline-flex items-center gap-2 text-ink-200">
                  {ChronIcon ? <ChronIcon className="h-3.5 w-3.5 shrink-0 text-ink-300" /> : <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />}
                  {t(CHRONICLE_LABEL_KEY[e.kind] ?? e.kind)}
                  {e.amountSol !== null && (
                    <span className="font-mono text-accent-neon">{e.amountSol.toFixed(2)} SOL</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-ink-500">
                  {new Date(e.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'history' && (
        history === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-white/5" aria-hidden="true" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-ink-400">{t('gamification.historyEmpty')}</p>
        ) : (
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {history.map((week) => {
              const hasBonus = week.claimedKeys.includes('bonus');
              const questsClaimed = QUEST_KEYS.filter((k) => week.claimedKeys.includes(k));
              return (
                <li
                  key={week.weekStart}
                  className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-ink-300">
                      {t('gamification.historyWeekOf')} {week.weekStart}
                    </span>
                    <span className="font-mono font-semibold text-accent-neon">+{week.xpTotal} XP</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {QUEST_KEYS.map((k) => {
                      const Icon = QUEST_ICON[k];
                      const got = questsClaimed.includes(k);
                      return <Icon key={k} className={`h-3 w-3 shrink-0 ${got ? 'text-accent-gold' : 'text-white/15'}`} />;
                    })}
                    {hasBonus && (
                      <span className="ml-1 text-[10px] text-accent-gold">{t('gamification.historyBonusIncluded')}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}

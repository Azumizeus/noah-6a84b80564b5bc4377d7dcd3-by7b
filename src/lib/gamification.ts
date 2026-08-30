// src/lib/gamification.ts
// ═══════════════════════════════════════════════════════════════════
// BuildPact — Gamification V1 + V2 (XP / rangs / badges / quêtes / classement).
//
// L'XP est un LEDGER append-only (table xp_events), écrit UNIQUEMENT côté
// serveur dans project-write (action "event") et quest-write (réclamation
// de quête), jamais depuis ce fichier. Ce module ne fait QUE LIRE : agréger
// l'XP (vue wallet_xp), calculer le rang, calculer les badges à la volée
// depuis pact_events (lecture publique, RLS `pact_events_public_read` /
// `xp_events_select_public`), et — V2 — piloter la réclamation de quêtes
// (signature ed25519, vérifiée côté serveur dans quest-write) ainsi que le
// calcul de série (streak) et de rareté des badges.
//
// Aucune table dédiée aux badges : les règles peuvent changer sans
// migration, au prix d'un recalcul à chaque lecture — largement
// suffisant au volume de cette V1/V2.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled, SUPABASE_PROJECT_URL } from './supabaseClient';

// ── Rangs ────────────────────────────────────────────────────────────
export interface RankLevel {
  key: string; // clé i18n gamification.rankXxx
  xpThreshold: number;
}

export const RANKS: RankLevel[] = [
  { key: 'rankAnon', xpThreshold: 0 },
  { key: 'rankContributor', xpThreshold: 100 },
  { key: 'rankBuilder', xpThreshold: 400 },
  { key: 'rankShipwright', xpThreshold: 1000 },
  { key: 'rankArchitect', xpThreshold: 2500 },
  { key: 'rankVeteran', xpThreshold: 6000 },
  { key: 'rankLegendary', xpThreshold: 15000 },
];

export interface RankProgress {
  rankKey: string;
  xp: number;
  nextRankKey: string | null;
  xpToNext: number | null; // null si rang maximum atteint
  progressPct: number; // 0-100, position dans la tranche du rang courant
}

/** Calcule le rang + la progression vers le suivant à partir d'un total XP. */
export function computeRank(xp: number): RankProgress {
  let current = RANKS[0];
  let next: RankLevel | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xpThreshold) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  const band = next ? next.xpThreshold - current.xpThreshold : 1;
  const into = xp - current.xpThreshold;
  const progressPct = next ? Math.min(100, Math.max(0, Math.round((into / band) * 100))) : 100;
  return {
    rankKey: current.key,
    xp,
    nextRankKey: next?.key ?? null,
    xpToNext: next ? next.xpThreshold - xp : null,
    progressPct,
  };
}

/** Lit le total XP d'un wallet depuis la vue agrégée wallet_xp. 0 si absent/erreur. */
export async function fetchWalletXp(wallet: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('wallet_xp')
    .select('xp_total')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error || !data) return 0;
  return Number(data.xp_total) || 0;
}

// ── Classement ───────────────────────────────────────────────────────
export interface LeaderboardRow {
  wallet: string;
  xp: number;
}

/** Classement global — lecture directe de la vue wallet_xp, déjà triable. */
export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('wallet_xp')
    .select('wallet, xp_total')
    .order('xp_total', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({ wallet: r.wallet as string, xp: Number(r.xp_total) }));
}

/**
 * Classement propre à un pact — pas de vue dédiée (trop peu de lignes par
 * projet pour justifier une vue Postgres), agrégation faite ici côté client
 * sur les xp_events filtrés par project_pda.
 */
export async function fetchPactLeaderboard(
  projectPda: string,
  limit = 50
): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('xp_events')
    .select('wallet, amount')
    .eq('project_pda', projectPda);
  if (error || !data) return [];
  const totals = new Map<string, number>();
  for (const row of data) {
    const w = row.wallet as string;
    totals.set(w, (totals.get(w) ?? 0) + Number(row.amount));
  }
  return Array.from(totals.entries())
    .map(([wallet, xp]) => ({ wallet, xp }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

// ── Badges — calculés à la volée depuis pact_events (lecture publique) ─
export type BadgeId =
  | 'serialFounder'
  | 'whaleBacker'
  | 'loyalBacker'
  | 'trustedApprover'
  | 'speedFinalizer'
  | 'nightOwl'
  | 'firstMover';

export const BADGE_ORDER: BadgeId[] = [
  'serialFounder',
  'whaleBacker',
  'loyalBacker',
  'trustedApprover',
  'speedFinalizer',
  'nightOwl',
  'firstMover',
];

export const BADGE_META: Record<BadgeId, { emoji: string; labelKey: string; descKey: string }> = {
  serialFounder: {
    emoji: '🌱',
    labelKey: 'gamification.badgeSerialFounder',
    descKey: 'gamification.badgeSerialFounderDesc',
  },
  whaleBacker: {
    emoji: '🐋',
    labelKey: 'gamification.badgeWhaleBacker',
    descKey: 'gamification.badgeWhaleBackerDesc',
  },
  loyalBacker: {
    emoji: '🔁',
    labelKey: 'gamification.badgeLoyalBacker',
    descKey: 'gamification.badgeLoyalBackerDesc',
  },
  trustedApprover: {
    emoji: '🤝',
    labelKey: 'gamification.badgeTrustedApprover',
    descKey: 'gamification.badgeTrustedApproverDesc',
  },
  speedFinalizer: {
    emoji: '⚡',
    labelKey: 'gamification.badgeSpeedFinalizer',
    descKey: 'gamification.badgeSpeedFinalizerDesc',
  },
  nightOwl: {
    emoji: '🌙',
    labelKey: 'gamification.badgeNightOwl',
    descKey: 'gamification.badgeNightOwlDesc',
  },
  firstMover: {
    emoji: '🎯',
    labelKey: 'gamification.badgeFirstMover',
    descKey: 'gamification.badgeFirstMoverDesc',
  },
};

/** Cible affichée pour la barre de progression d'un badge à seuil numérique.
 *  speedFinalizer/firstMover sont binaires (0 ou 1) — pas de "presque 5/24h". */
export const BADGE_TARGET: Record<BadgeId, number> = {
  serialFounder: 3,
  whaleBacker: 5, // SOL, pas un compte — voir computeBadgeProgressFromEvents
  loyalBacker: 3,
  trustedApprover: 10,
  speedFinalizer: 1,
  nightOwl: 5,
  firstMover: 1,
};

export interface BadgeProgress {
  unlocked: boolean;
  current: number;
  target: number;
}

interface RawEvent {
  kind: string;
  project_pda: string;
  amount_sol: number | null;
  created_at: string;
  actor?: string; // présent uniquement dans le calcul groupé (fetchBadgeRarity)
}

/**
 * Cœur pur des règles de badges — sépare le calcul (testable, réutilisable)
 * de l'accès réseau. Utilisé à la fois pour UN wallet (computeBadgeProgress)
 * et en masse pour TOUS les wallets (fetchBadgeRarity), sans dupliquer les
 * règles à deux endroits qui pourraient diverger.
 *
 * `creatorRank` : rang (0-based) du tout premier événement 'create' de ce
 * wallet parmi TOUS les événements 'create' du protocole, déjà trié par
 * date — évite une requête COUNT séparée par wallet quand on a déjà
 * l'ensemble complet des événements sous la main (cas de fetchBadgeRarity).
 * `undefined` déclenche un calcul via requête réseau (cas mono-wallet).
 */
function computeBadgeProgressFromEvents(
  events: RawEvent[],
  creatorRank?: number
): Record<BadgeId, BadgeProgress> {
  const creates = events.filter((e) => e.kind === 'create');
  const funds = events.filter((e) => e.kind === 'fund');
  const approveProjects = new Set(
    events.filter((e) => e.kind === 'approve').map((e) => e.project_pda)
  );
  const finalizes = events.filter((e) => e.kind === 'finalize');

  const fundsByProject = new Map<string, number>();
  for (const f of funds) {
    fundsByProject.set(f.project_pda, (fundsByProject.get(f.project_pda) ?? 0) + 1);
  }
  const maxFundsOnOneProject = Math.max(0, ...Array.from(fundsByProject.values()));
  const maxSingleFundSol = Math.max(0, ...funds.map((f) => f.amount_sol ?? 0));

  const speedy = finalizes.some((fin) => {
    const create = creates.find((c) => c.project_pda === fin.project_pda);
    if (!create) return false;
    const diffMs = new Date(fin.created_at).getTime() - new Date(create.created_at).getTime();
    return diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000;
  });

  const nightCount = events.filter((e) => {
    const h = new Date(e.created_at).getUTCHours();
    return h >= 0 && h < 5;
  }).length;

  const isFirstMover = creatorRank !== undefined ? creatorRank < 50 : false;

  return {
    serialFounder: { unlocked: creates.length >= 3, current: Math.min(creates.length, 3), target: 3 },
    whaleBacker: {
      unlocked: maxSingleFundSol >= 5,
      current: Math.min(Math.round(maxSingleFundSol * 10) / 10, 5),
      target: 5,
    },
    loyalBacker: {
      unlocked: maxFundsOnOneProject >= 3,
      current: Math.min(maxFundsOnOneProject, 3),
      target: 3,
    },
    trustedApprover: {
      unlocked: approveProjects.size >= 10,
      current: Math.min(approveProjects.size, 10),
      target: 10,
    },
    speedFinalizer: { unlocked: speedy, current: speedy ? 1 : 0, target: 1 },
    nightOwl: { unlocked: nightCount >= 5, current: Math.min(nightCount, 5), target: 5 },
    firstMover: { unlocked: isFirstMover, current: isFirstMover ? 1 : 0, target: 1 },
  };
}

/**
 * Calcule la progression (débloqué + compteur courant/cible) de TOUS les
 * badges d'un wallet. Remplace l'ancien computeBadges() qui ne renvoyait
 * que la liste des débloqués — BadgeShelf V2 affiche aussi les verrouillés
 * en grisé avec leur compteur (ex. "7/10"), ce que la V1 jetait après calcul.
 */
export async function computeBadgeProgress(wallet: string): Promise<Record<BadgeId, BadgeProgress>> {
  const empty = computeBadgeProgressFromEvents([], undefined);
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from('pact_events')
    .select('kind, project_pda, amount_sol, created_at')
    .eq('actor', wallet);
  if (error || !data) return empty;
  const events = data as RawEvent[];

  let creatorRank: number | undefined;
  const firstCreate = events
    .filter((e) => e.kind === 'create')
    .reduce<string | null>((min, c) => (min === null || c.created_at < min ? c.created_at : min), null);
  if (firstCreate) {
    const { count } = await supabase
      .from('pact_events')
      .select('actor', { count: 'exact', head: true })
      .eq('kind', 'create')
      .lt('created_at', firstCreate);
    creatorRank = count ?? 0;
  }

  return computeBadgeProgressFromEvents(events, creatorRank);
}

/** Compat V1 : liste des badges débloqués uniquement. Conservé au cas où
 *  un appelant futur n'a besoin que de ça — BadgeShelf est passé à
 *  computeBadgeProgress() pour l'affichage grisé/compteur. */
export async function computeBadges(wallet: string): Promise<BadgeId[]> {
  const progress = await computeBadgeProgress(wallet);
  return BADGE_ORDER.filter((id) => progress[id].unlocked);
}

/**
 * Rareté de chaque badge = % de wallets actifs (ayant au moins un
 * pact_event) qui l'ont débloqué. Calculée en UNE lecture de pact_events
 * (49 lignes à ce stade du projet — largement dans le budget d'un fetch
 * client unique) plutôt qu'une requête par wallet : on regroupe par
 * `actor`, on rejoue les mêmes règles que computeBadgeProgressFromEvents
 * pour chacun, en mémoire, sans aller-retour réseau supplémentaire — y
 * compris pour firstMover, dont le rang se déduit directement du tri des
 * 'create' déjà en main.
 */
export async function fetchBadgeRarity(): Promise<Record<BadgeId, number>> {
  const zero = BADGE_ORDER.reduce((acc, id) => ({ ...acc, [id]: 0 }), {} as Record<BadgeId, number>);
  if (!supabase) return zero;
  const { data, error } = await supabase
    .from('pact_events')
    .select('kind, project_pda, amount_sol, created_at, actor');
  if (error || !data || data.length === 0) return zero;
  const all = data as Required<RawEvent>[];

  const byWallet = new Map<string, RawEvent[]>();
  for (const e of all) {
    const list = byWallet.get(e.actor) ?? [];
    list.push(e);
    byWallet.set(e.actor, list);
  }

  // Rang de création de CHAQUE wallet — tri global des 'create' une seule
  // fois, puis premier index par wallet, au lieu d'une requête par wallet.
  const createsSorted = all.filter((e) => e.kind === 'create').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const firstCreateRank = new Map<string, number>();
  createsSorted.forEach((e, i) => {
    if (!firstCreateRank.has(e.actor)) firstCreateRank.set(e.actor, i);
  });

  const totalWallets = byWallet.size;
  if (totalWallets === 0) return zero;

  const holders: Record<BadgeId, number> = { ...zero };
  for (const [wallet, events] of byWallet) {
    const progress = computeBadgeProgressFromEvents(events, firstCreateRank.get(wallet));
    for (const id of BADGE_ORDER) {
      if (progress[id].unlocked) holders[id] += 1;
    }
  }

  const pct: Record<BadgeId, number> = { ...zero };
  for (const id of BADGE_ORDER) {
    pct[id] = Math.round((holders[id] / totalWallets) * 100);
  }
  return pct;
}

// ── Chronique — historique horodaté d'un wallet ─────────────────────
export interface ChronicleEntry {
  kind: string;
  projectPda: string;
  amountSol: number | null;
  createdAt: string;
}

/** Historique brut des actions d'un wallet, le plus récent en premier —
 *  simple relecture de pact_events, aucun calcul. Sert l'onglet "Chronique"
 *  du journal de quêtes : un journal raconte, il ne fait pas que cocher. */
export async function fetchWalletChronicle(wallet: string, limit = 30): Promise<ChronicleEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('pact_events')
    .select('kind, project_pda, amount_sol, created_at')
    .eq('actor', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    kind: r.kind as string,
    projectPda: r.project_pda as string,
    amountSol: r.amount_sol === null ? null : Number(r.amount_sol),
    createdAt: r.created_at as string,
  }));
}

// ── Quêtes hebdomadaires ─────────────────────────────────────────────
// Pas de table dédiée pour le PROGRÈS (calculé à la volée depuis
// pact_events) ; `quest_claims` ne stocke QUE les réclamations effectives
// (le geste, pas le calcul) — voir migration quest_claims_and_extra_palettes
// et supabase/functions/quest-write.
//
// Semaine = UTC, lundi 00:00. V1 utilisait l'heure LOCALE du navigateur ;
// passé en UTC en V2 pour que le calcul soit identique à celui, forcément
// serveur, de quest-write (qui doit trancher sans connaître le fuseau de
// l'appelant). Un wallet actif juste autour de minuit peut donc voir sa
// "semaine" décalée de quelques heures par rapport à V1 — non-problème en
// pratique, aucune quête n'était encore réclamable avant ce jour.
export interface QuestProgress {
  fund: { done: number; target: number };
  approve: { done: number; target: number };
  finalize: { done: number; target: number };
}

export type QuestKey = 'fund' | 'approve' | 'finalize';
export const QUEST_KEYS: QuestKey[] = ['fund', 'approve', 'finalize'];
/** Récompense de RÉCLAMATION (V2) — distincte de l'XP de base déjà attribué
 *  pour l'action elle-même dans project-write. Doit rester synchronisée
 *  avec QUEST_XP côté quest-write. */
export const QUEST_CLAIM_XP: Record<QuestKey, number> = { fund: 40, approve: 30, finalize: 60 };
export const QUEST_BONUS_XP = 150;

/** Lundi 00:00 UTC courant, format YYYY-MM-DD — DOIT être calculé
 *  IDENTIQUEMENT à currentWeekStartUtc() dans supabase/functions/quest-write,
 *  sinon une réclamation légitime serait rejetée pour "mauvaise semaine". */
function startOfWeekUtcDateStr(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = dimanche
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

function startOfWeekUtcIso(): string {
  return `${startOfWeekUtcDateStr()}T00:00:00.000Z`;
}

export async function fetchWeeklyQuestProgress(wallet: string): Promise<QuestProgress> {
  const empty: QuestProgress = {
    fund: { done: 0, target: 2 },
    approve: { done: 0, target: 1 },
    finalize: { done: 0, target: 1 },
  };
  if (!supabase) return empty;
  const since = startOfWeekUtcIso();
  const { data, error } = await supabase
    .from('pact_events')
    .select('kind, project_pda')
    .eq('actor', wallet)
    .gte('created_at', since);
  if (error || !data) return empty;

  const fundedProjects = new Set(
    data.filter((e) => e.kind === 'fund').map((e) => e.project_pda as string)
  );
  const approveCount = data.filter((e) => e.kind === 'approve').length;
  const finalizeCount = data.filter((e) => e.kind === 'finalize').length;

  return {
    fund: { done: Math.min(fundedProjects.size, empty.fund.target), target: empty.fund.target },
    approve: {
      done: Math.min(approveCount, empty.approve.target),
      target: empty.approve.target,
    },
    finalize: {
      done: Math.min(finalizeCount, empty.finalize.target),
      target: empty.finalize.target,
    },
  };
}

/** Quêtes (+ bonus) déjà réclamées cette semaine pour un wallet — simple
 *  lecture publique de quest_claims, sert à griser le bouton "Réclamer"
 *  d'une quête déjà encaissée. */
export async function fetchClaimedThisWeek(wallet: string): Promise<Set<QuestKey | 'bonus'>> {
  const set = new Set<QuestKey | 'bonus'>();
  if (!supabase) return set;
  const { data, error } = await supabase
    .from('quest_claims')
    .select('quest_key')
    .eq('wallet', wallet)
    .eq('week_start', startOfWeekUtcDateStr());
  if (error || !data) return set;
  for (const row of data) set.add(row.quest_key as QuestKey | 'bonus');
  return set;
}

/**
 * Série (streak) hebdomadaire — nombre de semaines CONSÉCUTIVES et
 * COMPLÈTES (les 3 quêtes réclamées) menant à la plus récente semaine déjà
 * bouclée. La semaine EN COURS n'est jamais comptée avant d'être complète
 * elle-même : un streak qui casserait au milieu de la semaine courante
 * découragerait avant même que le joueur ait eu le temps de finir.
 *
 * Hebdomadaire et pas quotidien (choix produit, voir GAMIFICATION_PLAN.md) :
 * un streak journalier inciterait à multiplier des transactions payantes
 * juste pour ne pas le perdre — mauvaise incitation sur un protocole
 * on-chain où chaque action coûte des frais réels.
 */
export async function fetchQuestStreak(wallet: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('quest_claims')
    .select('week_start, quest_key')
    .eq('wallet', wallet)
    .in('quest_key', QUEST_KEYS)
    .order('week_start', { ascending: false });
  if (error || !data || data.length === 0) return 0;

  const byWeek = new Map<string, Set<string>>();
  for (const row of data) {
    const w = row.week_start as string;
    const set = byWeek.get(w) ?? new Set<string>();
    set.add(row.quest_key as string);
    byWeek.set(w, set);
  }
  const completeWeeks = Array.from(byWeek.entries())
    .filter(([, keys]) => QUEST_KEYS.every((k) => keys.has(k)))
    .map(([week]) => week)
    .sort((a, b) => b.localeCompare(a));
  if (completeWeeks.length === 0) return 0;

  const currentWeek = startOfWeekUtcDateStr();
  // Point de départ du décompte : la semaine complète la plus récente qui
  // n'est PAS la semaine en cours (sinon un streak "en cours de semaine"
  // se compterait avant d'être vraiment acquis).
  let cursor = completeWeeks[0] === currentWeek ? 1 : 0;
  if (cursor >= completeWeeks.length) return 0;

  let streak = 1;
  let cursorDate = new Date(`${completeWeeks[cursor]}T00:00:00.000Z`);
  for (let i = cursor + 1; i < completeWeeks.length; i++) {
    const prevWeek = new Date(cursorDate);
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
    if (completeWeeks[i] === prevWeek.toISOString().slice(0, 10)) {
      streak += 1;
      cursorDate = prevWeek;
    } else {
      break;
    }
  }
  return streak;
}

// ── Historique des semaines passées (29/08, soir — "un vrai historique
// visuel des semaines passées", demande explicite après refonte du
// journal) ──────────────────────────────────────────────────────────
// Aucune nouvelle table : `quest_claims` (lecture publique, policy
// `quest_claims_public_read`) contient déjà une ligne par réclamation
// (wallet, week_start, quest_key, xp_awarded, claimed_at) — exactement
// ce qu'il faut pour reconstituer semaine par semaine ce qui a été
// réclamé, sans rien recalculer côté serveur.
export interface QuestWeekHistory {
  weekStart: string; // YYYY-MM-DD, lundi UTC
  claimedKeys: Array<QuestKey | 'bonus'>;
  xpTotal: number;
}

export async function fetchQuestHistory(wallet: string, weeksLimit = 8): Promise<QuestWeekHistory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('quest_claims')
    .select('week_start, quest_key, xp_awarded')
    .eq('wallet', wallet)
    .order('week_start', { ascending: false });
  if (error || !data || data.length === 0) return [];

  const byWeek = new Map<string, QuestWeekHistory>();
  for (const row of data) {
    const week = row.week_start as string;
    const entry = byWeek.get(week) ?? { weekStart: week, claimedKeys: [], xpTotal: 0 };
    entry.claimedKeys.push(row.quest_key as QuestKey | 'bonus');
    entry.xpTotal += Number(row.xp_awarded ?? 0);
    byWeek.set(week, entry);
  }
  return Array.from(byWeek.values())
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, weeksLimit);
}

const QUEST_WRITE_URL = SUPABASE_PROJECT_URL ? `${SUPABASE_PROJECT_URL}/functions/v1/quest-write` : '';

export interface ClaimQuestResult {
  ok: boolean;
  error?: string;
  xpAwarded?: number;
  bonusAwarded?: boolean;
  alreadyClaimed?: boolean;
}

/**
 * Réclame la récompense d'une quête hebdomadaire terminée. Fait signer un
 * message au wallet (le geste de clic + popup wallet EST la mécanique
 * d'habitude recherchée, voir GAMIFICATION_PLAN.md V2), envoie signature +
 * message à quest-write, qui revérifie la complétion réelle côté serveur
 * avant de créditer l'XP — jamais sur la seule foi du client.
 */
export async function claimQuestReward(
  wallet: string,
  questKey: QuestKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<ClaimQuestResult> {
  if (!isRemoteEnabled || !QUEST_WRITE_URL) {
    return { ok: false, error: 'Service indisponible.' };
  }
  const week = startOfWeekUtcDateStr();
  const timestamp = Date.now();
  const message = `BuildPact — réclamation de quête\nWallet: ${wallet}\nQuête: ${questKey}\nSemaine: ${week}\nTimestamp: ${timestamp}`;

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = await signMessage(new TextEncoder().encode(message));
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    if (msg.toLowerCase().includes('user rejected')) {
      return { ok: false, error: 'Signature refusée.' };
    }
    return { ok: false, error: 'Ce wallet ne supporte pas la signature de message.' };
  }

  try {
    const res = await fetch(QUEST_WRITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questKey, message, signature: Array.from(signatureBytes) }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error ?? 'Échec de la réclamation.' };
    return { ok: true, xpAwarded: json?.xpAwarded, bonusAwarded: json?.bonusAwarded, alreadyClaimed: json?.alreadyClaimed };
  } catch {
    return { ok: false, error: 'Réseau injoignable — réessaie.' };
  }
}

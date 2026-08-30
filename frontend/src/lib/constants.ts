import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ');

// ═══════════════════════════════════════════════════════════════════
// RPC — deux listes distinctes, LECTURE et ÉCRITURE
//
// Pourquoi séparer, alors qu'une seule liste suffisait avant :
//
// Helius refuse `getProgramAccounts` sur cette clé — erreur -32401,
// systématiquement (constaté en curl, en fetch direct, et depuis
// l'application : 100 % des essais, jamais une réussite). C'est un
// bridage côté fournisseur, pas un incident passager : un scan complet
// de programme est coûteux et couramment réservé aux plans supérieurs.
// Or `getProgramAccounts` est l'appel qui liste TOUS les pacts — donc
// la moitié de l'application ne pouvait pas charger.
//
// Le devnet public, lui, répond très bien à `getProgramAccounts`. En
// revanche il throttle (429) dès qu'on lui envoie un volume soutenu, et
// c'est un nœud partagé : moins fiable pour faire atterrir une
// transaction (blockhash périmé, propagation lente).
//
// D'où la répartition : LECTURE au devnet public d'abord (il sait faire
// ce dont on a besoin), ÉCRITURE sur Helius d'abord (nœud dédié, ce qui
// avait justement réglé les « Blockhash not found » — on n'y touche pas).
// Chaque liste garde l'autre endpoint en repli.
//
// Ankr a été retiré : `rpc.ankr.com/solana_devnet` ne répond plus (il
// exige désormais une clé). Le laisser en position 2 revenait à faire
// perdre une rotation entière à chaque incident.
//
// Deux noms de variable acceptés : VITE_RPC_ENDPOINT (canonique) et
// VITE_REACT_APP_SOLANA_RPC_URL (hérité du .env existant). Sans ce double
// lookup, la clé Helius du .env n'était jamais lue.
// ═══════════════════════════════════════════════════════════════════
const DEDICATED_RPC =
  (import.meta.env.VITE_RPC_ENDPOINT as string) ||
  (import.meta.env.VITE_REACT_APP_SOLANA_RPC_URL as string) ||
  '';

const PUBLIC_DEVNET = 'https://api.devnet.solana.com';

/** Clé localStorage du RPC personnalisé (réglage "power user", voir
 *  CustomRpcSettings.tsx). Lu UNE SEULE FOIS au chargement du module,
 *  comme DEDICATED_RPC ci-dessus (même limite que .env : Vite ne relit
 *  ses variables qu'au démarrage — ici c'est le rechargement de page qui
 *  joue ce rôle, annoncé dans l'UI). */
const CUSTOM_RPC_KEY = 'buildpact_custom_rpc';

function readCustomRpc(): string {
  try {
    return localStorage.getItem(CUSTOM_RPC_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

const CUSTOM_RPC = readCustomRpc();

/** Valeur actuellement enregistrée (pour pré-remplir le champ de réglage). */
export function getCustomRpc(): string {
  return CUSTOM_RPC;
}

/** Enregistre un RPC personnalisé. Ne prend effet qu'après rechargement de
 *  la page — READ_RPC_ENDPOINTS/WRITE_RPC_ENDPOINTS sont figés au chargement
 *  du module, comme DEDICATED_RPC (voir commentaire plus haut). */
export function setCustomRpc(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) localStorage.setItem(CUSTOM_RPC_KEY, trimmed);
    else localStorage.removeItem(CUSTOM_RPC_KEY);
  } catch {
    /* localStorage indisponible (navigation privée, quota) — non bloquant */
  }
}

/** Lectures (scan de programme, soldes, historique) — le RPC personnalisé,
 *  s'il est renseigné, passe devant TOUT (y compris le devnet public) :
 *  c'est le sens même du réglage "j'ai ma propre clé Helius/QuickNode,
 *  utilise-la en priorité". Sans lui, ordre inchangé (devnet public
 *  d'abord). */
export const READ_RPC_ENDPOINTS: string[] = Array.from(
  new Set([CUSTOM_RPC, PUBLIC_DEVNET, DEDICATED_RPC].filter(Boolean))
) as string[];

/** Écritures (envoi + confirmation de transactions) — même priorité. */
export const WRITE_RPC_ENDPOINTS: string[] = Array.from(
  new Set([CUSTOM_RPC, DEDICATED_RPC, PUBLIC_DEVNET].filter(Boolean))
) as string[];

/**
 * Endpoint par défaut du ConnectionProvider. C'est une connexion de LECTURE :
 * tout ce qui passe par `useConnection()` interroge la chaîne (soldes, comptes,
 * historique). Les transactions, elles, ne l'utilisent pas — `buildAndSend()`
 * crée sa propre connexion sur la liste d'écriture.
 */
export const RPC_ENDPOINT = READ_RPC_ENDPOINTS[0];

/** Conservé pour compatibilité : la liste historique = celle d'écriture. */
export const RPC_ENDPOINTS = WRITE_RPC_ENDPOINTS;

// Deux curseurs indépendants : une rotation déclenchée par un 429 en lecture
// ne doit pas déplacer l'endpoint d'écriture (et inversement), sinon un
// incident sur une liste dégrade l'autre sans raison.
let readIndex = 0;
let writeIndex = 0;

export function getReadRpcEndpoint(): string {
  return READ_RPC_ENDPOINTS[readIndex % READ_RPC_ENDPOINTS.length];
}

export function rotateReadRpc(): string {
  readIndex = (readIndex + 1) % READ_RPC_ENDPOINTS.length;
  console.warn('[RPC:read] Rotation vers :', getReadRpcEndpoint());
  return getReadRpcEndpoint();
}

/** Endpoint d'écriture courant (nom historique, conservé pour anchor.ts). */
export function getRpcEndpoint(): string {
  return WRITE_RPC_ENDPOINTS[writeIndex % WRITE_RPC_ENDPOINTS.length];
}

export function rotateRpc(): string {
  writeIndex = (writeIndex + 1) % WRITE_RPC_ENDPOINTS.length;
  console.warn('[RPC:write] Rotation vers :', getRpcEndpoint());
  return getRpcEndpoint();
}

/** Lit un message d'erreur sans passer par `any` (tout peut être throw en JS). */
function errorText(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(e);
}

export function isRateLimitError(e: unknown): boolean {
  const msg = errorText(e);
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('Too Many Requests') ||
    msg.includes('-32005') // limite de nœud (web3.js remonte parfois ce code)
  );
}

/**
 * Méthode refusée par le fournisseur (Helius : -32401 sur getProgramAccounts).
 * À distinguer d'un 429 : un throttle se résorbe, un bridage de méthode jamais.
 * Réessayer sur le même endpoint est donc du temps perdu — il faut tourner.
 */
export function isMethodNotAllowedError(e: unknown): boolean {
  const msg = errorText(e);
  return (
    msg.includes('-32401') ||
    msg.includes('not allowed') ||
    msg.includes('is disabled') ||
    msg.includes('Method not found')
  );
}

/** Backoff progressif entre deux tentatives (250ms → 500 → 1000 → 2000, plafonné). */
export function backoffDelayMs(attempt: number): number {
  return Math.min(250 * 2 ** Math.max(0, attempt - 1), 4000);
}

export const MAX_MEMBERS = 8;
export const TOTAL_BPS = 10_000;

export const PROJECT_SEED = 'project';
export const VAULT_SEED = 'vault';

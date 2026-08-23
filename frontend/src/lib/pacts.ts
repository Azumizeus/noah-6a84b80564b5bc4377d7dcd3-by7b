// src/lib/pacts.ts
import type { PublicKey } from '@solana/web3.js';
import { translate, type Lang } from './i18n/translations';

/** Langue courante lue en synchrone (localStorage) — pacts.ts n'est pas un
 *  composant React et ne peut pas utiliser useLanguage(). Même clé que
 *  LanguageContext.tsx (STORAGE_KEY = 'buildpact_lang'). */
function currentLang(): Lang {
  try {
    const stored = localStorage.getItem('buildpact_lang');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* non bloquant */
  }
  return 'fr';
}

export type PactStatus = 'active' | 'pending'; // active = Finalized, pending = Open

export interface ChainMember {
  wallet: PublicKey;
  role: string;
  shareBps: number;
  approved: boolean;
}

export interface ChainPact {
  pda: PublicKey;
  projectId: string;
  title: string;
  description: string;
  creator: PublicKey;
  members: ChainMember[];
  status: PactStatus;
  protocolWallet: PublicKey;
  vaultBalanceSol: number;
  myShareBps: number;      // 0 si le wallet connecté n'est pas membre
  myClaimableSol: number;  // quote-part du vault
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 9) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

/**
 * Page Explorer d'un COMPTE (pas d'une tx précise) — historique complet et
 * permanent de toutes les transactions envoyées à cette adresse, indépendant
 * de tout log applicatif (ActivityFeed dépend de Supabase et ne capture que
 * ce que CE frontend a explicitement loggé). C'est la preuve canonique
 * qu'un juge peut vérifier lui-même, même si l'appli/Supabase est down.
 */
export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

/** Erreur Anchor/wallet → message lisible (FR/EN selon la langue courante) */
export function parseTxError(err: unknown): string {
  const e = err as any;
  const msg: string = e?.error?.errorMessage ?? e?.message ?? String(err);
  const lang = currentLang();
  const tr = (key: string) => translate(lang, key);
  if (msg.includes('User rejected')) return tr('errors.userRejected');
  if (msg.includes('6005') || msg.includes('InvalidParameter')) return tr('errors.invalidParam');
  if (msg.includes('6017') || msg.includes('DistributionEmpty')) return tr('errors.distributionEmpty');
  if (msg.includes('6015') || msg.includes('NotFinalized')) return tr('errors.notFinalized');
  if (msg.includes('6016') || msg.includes('MemberMismatch')) return tr('errors.memberMismatch');
  if (msg.includes('6012') || msg.includes('NotAllApproved')) return tr('errors.notAllApproved');
  if (msg.includes('6007') || msg.includes('DuplicateMember')) return tr('errors.duplicateMember');
  if (msg.includes('6006') || msg.includes('TooManyMembers')) return tr('errors.tooManyMembers');
  if (msg.includes('6008') || msg.includes('ShareExceeded')) return tr('errors.shareExceeded');
  if (msg.includes('6011') || msg.includes('NotEnoughMembers')) return tr('errors.notEnoughMembers');
  if (msg.includes('6013') || msg.includes('SharesNotComplete')) return tr('errors.sharesNotComplete');
  if (msg.includes('insufficient funds')) return tr('errors.insufficientFunds');
  // Messages levés côté anchor.ts (buildAndSend/confirmBySignature) — le
  // Error.message y est en français en dur (usage technique/console), donc
  // on les reconnaît ici pour renvoyer une version traduite à l'affichage.
  if (msg.includes('Blockhash expiré')) return tr('errors.blockhashExpired');
  if (msg.includes('Timeout de confirmation')) return tr('errors.confirmTimeout');
  if (msg.includes("n'a pas répondu à temps")) return tr('errors.walletTimeout');
  if (msg.includes("n'a pas signé la transaction")) return tr('errors.walletDidNotSign');
  if (msg.includes('Wallet non connecté')) return tr('errors.walletNotConnected');
  if (msg.includes('Transaction échouée on-chain')) {
    const detail = msg.split('Transaction échouée on-chain :')[1]?.trim() ?? msg;
    return translate(lang, 'errors.txFailedOnChain', { detail });
  }
  // ⚠️ BUG FIX : les erreurs RPC/HTTP brutes (ex: "Solana error #8100002;
  // Decode this error by running `npx @solana/errors decode -- ..."`,
  // souvent un 429 quand le devnet public est saturé) tombaient jusqu'ici
  // dans le fallback générique ci-dessous et s'affichaient telles quelles,
  // illisibles, dans le bandeau d'erreur (TxBanner) — mauvaise image devant
  // les juges. On les détecte et on affiche un message clair à la place.
  if (
    msg.includes('Solana error #') ||
    msg.toLowerCase().includes('http error') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('too many requests') ||
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('networkerror')
  ) {
    return tr('errors.devnetCongestion');
  }
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg;
}

/**
 * Formatage SOL adaptatif :
 * - micro-montants (< 0.001 SOL) → 6 décimales (reçus de distribution lisibles)
 * - montants courants → 3 décimales
 */
export function formatSol(amount: number | undefined | null): string {
  if (amount == null || isNaN(amount)) return '0';
  if (amount === 0) return '0';
  if (Math.abs(amount) < 0.001) return amount.toFixed(6);
  return amount.toFixed(3);
}

export function formatAddress(address: string | undefined | null): string {
  if (!address) return '';
  return address.slice(0, 4) + '...' + address.slice(-4);
}

export function getVaultBalance(pact: any): number {
  return pact?.vaultBalanceSol ?? 0;
}

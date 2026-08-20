// src/lib/pacts.ts
import type { PublicKey } from '@solana/web3.js';

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

/** Erreur Anchor/wallet → message lisible */
export function parseTxError(err: unknown): string {
  const e = err as any;
  const msg: string = e?.error?.errorMessage ?? e?.message ?? String(err);
  if (msg.includes('User rejected')) return 'Transaction refusée dans le wallet.';
  if (msg.includes('6017') || msg.includes('DistributionEmpty')) return 'Vault vide — rien à distribuer.';
  if (msg.includes('6015') || msg.includes('NotFinalized')) return 'Projet non finalisé.';
  if (msg.includes('6016') || msg.includes('MemberMismatch')) return 'Liste des membres invalide.';
  if (msg.includes('6012') || msg.includes('NotAllApproved')) return 'Tous les membres n\'ont pas approuvé.';
  if (msg.includes('insufficient funds')) return 'SOL insuffisant pour les frais de transaction.';
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

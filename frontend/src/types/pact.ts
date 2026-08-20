export type { ChainPact as Pact } from '../lib/pacts';

export type PactAction = 'distribute' | 'fund' | 'finalize' | null;

// ═══ Reçu de distribution (split déterministe calculé off-chain) ═══
export interface DistributionPayout {
  wallet: string;   // base58
  shareBps: number;
  amountSol: number;
}

export interface DistributionReceipt {
  signature: string;
  grossSol: number;   // vault avant distribution
  netSol: number;     // montant réparti entre les membres
  feeSol: number;     // frais protocole (2%)
  payouts: DistributionPayout[];
  executedAt: number; // timestamp ms
}

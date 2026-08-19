// src/lib/pacts.ts
export type PactStatus = 'active' | 'pending' | 'closed';

export interface Pact {
  id: string;
  title: string;
  counterparty: string;
  shareBps: number;
  claimable: number;
  totalEarned: number;
  status: PactStatus;
  lastClaimAt?: string;
}

// Données démo — remplacées par les comptes Anchor à l'intégration program
export const PACTS: Pact[] = [
  { id: 'pact-01', title: 'Revenue Share — Marketplace Fees', counterparty: '9WzD…E9gC',
    shareBps: 2500, claimable: 12.5, totalEarned: 87.3124, status: 'active', lastClaimAt: 'il y a 2 h' },
  { id: 'pact-02', title: 'NFT Royalties — Genesis Drop', counterparty: '5HsT…kL9p',
    shareBps: 1000, claimable: 5.9231, totalEarned: 32.1047, status: 'active', lastClaimAt: 'il y a 1 j' },
  { id: 'pact-03', title: 'Validator Commission Split', counterparty: '2PcE…mN7r',
    shareBps: 5000, claimable: 0, totalEarned: 23.1189, status: 'pending', lastClaimAt: 'il y a 3 j' },
  { id: 'pact-04', title: 'Q1 Bonus — Closed Pact', counterparty: '7FkL…tR4s',
    shareBps: 1500, claimable: 0, totalEarned: 5.0, status: 'closed', lastClaimAt: 'il y a 14 j' },
];

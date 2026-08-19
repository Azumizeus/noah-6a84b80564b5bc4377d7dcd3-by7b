import type { PublicKey } from '@solana/web3.js';

export interface Pact {
  pda: PublicKey;
  status: string;
  title?: string;
  vaultBalanceSol?: number;
  myClaimableSol?: number;
  [key: string]: any;
}

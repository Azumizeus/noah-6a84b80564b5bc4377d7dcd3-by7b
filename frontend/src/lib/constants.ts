import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('266V7Jct9EVWPeHscDwBpL13251EMUyak7WR9QiT59kQ');

// ═══ RPC avec fallback — Helius (env) → Ankr → Solana officiel ═══
export const RPC_ENDPOINTS: string[] = [
  import.meta.env.VITE_RPC_ENDPOINT as string,
  'https://rpc.ankr.com/solana_devnet',
  'https://api.devnet.solana.com',
].filter(Boolean) as string[];

export const RPC_ENDPOINT = RPC_ENDPOINTS[0];

let currentIndex = 0;

export function getRpcEndpoint(): string {
  return RPC_ENDPOINTS[currentIndex % RPC_ENDPOINTS.length];
}

export function rotateRpc(): string {
  currentIndex = (currentIndex + 1) % RPC_ENDPOINTS.length;
  console.warn('[RPC] Rotation vers :', getRpcEndpoint());
  return getRpcEndpoint();
}

export function isRateLimitError(e: unknown): boolean {
  const msg = (e as any)?.message ?? String(e);
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('Too Many Requests');
}

export const MAX_MEMBERS = 8;
export const TOTAL_BPS = 10_000;

export const PROJECT_SEED = 'project';
export const VAULT_SEED = 'vault';

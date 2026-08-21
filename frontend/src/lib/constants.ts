import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ');

// ═══ RPC avec fallback — Helius (dédié) → Ankr → Solana officiel ═══
// Helius = node unique, pas de load balancer → fix "Blockhash not found"
const HELIUS_RPC = 'https://devnet.helius-rpc.com/?api-key=fc3853b9-07dd-4f31-9ba3-af7d0ddf8ecc';

export const RPC_ENDPOINTS: string[] = [
  (import.meta.env.VITE_RPC_ENDPOINT as string) || HELIUS_RPC,
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

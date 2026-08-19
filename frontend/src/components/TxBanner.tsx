// src/components/TxBanner.tsx
import type { TxState } from '../hooks/useProjects';
import { explorerTxUrl } from '../lib/pacts';

export function TxBanner({ state }: { state: TxState | null }) {
  if (!state) return null;
  const ok = state.kind === 'success';
  return (
    <div
      role="status"
      className={
        'rounded-xl border px-4 py-3 text-sm ' +
        (ok
          ? 'border-accent-neon/30 bg-accent-neon/10 text-accent-neon'
          : 'border-red-400/30 bg-red-400/10 text-red-300')
      }
    >
      {state.text}
      {state.sig && (
        <a
          href={explorerTxUrl(state.sig)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline underline-offset-4 hover:opacity-80"
        >
          Voir la transaction ↗
        </a>
      )}
    </div>
  );
}

export default TxBanner;

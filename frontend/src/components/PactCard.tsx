// src/components/PactCard.tsx
import { useState } from 'react';
import { truncateAddress, type ChainPact } from '../lib/pacts';

interface PactCardProps {
  pact: ChainPact;
  walletConnected: boolean;
  busyAction: 'distribute' | 'fund' | 'finalize' | null;
  onDistribute: (pact: ChainPact) => void;
  onFund: (pact: ChainPact, amountSol: number) => void;
  onFinalize: (pact: ChainPact) => void;
}

export function PactCard({ pact, walletConnected, busyAction, onDistribute, onFund, onFinalize }: PactCardProps) {
  const [fundOpen, setFundOpen] = useState(false);
  const [amount, setAmount] = useState('0.1');

  const isActive = pact.status === 'active';
  const approvedCount = pact.members.filter((m) => m.approved).length;
  const sharePct = (pact.myShareBps / 100).toFixed(2);
  const distributing = busyAction === 'distribute';
  const funding = busyAction === 'fund';
  const finalizing = busyAction === 'finalize';

  const allApproved = approvedCount === pact.members.length && pact.members.length > 0;
  const canFinalize = walletConnected && !isActive && allApproved && busyAction === null;

  const distributeDisabled = !walletConnected || !isActive || pact.vaultBalanceSol <= 0 || busyAction !== null;
  const distributeReason = !walletConnected
    ? 'Connectez votre wallet'
    : !isActive
      ? 'Projet non finalisé — approbations en cours'
      : pact.vaultBalanceSol <= 0
        ? 'Vault vide — rien à distribuer'
        : undefined;

  const confirmFund = () => {
    const sol = parseFloat(amount);
    if (!Number.isFinite(sol) || sol <= 0 || sol > 100) return;
    onFund(pact, sol);
    setFundOpen(false);
  };

  return (
    <article className="glass-panel glass-panel-hover flex h-full flex-col p-5">
      {/* Badge + share */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ' +
            (isActive
              ? 'border-accent-neon/30 bg-accent-neon/10 text-accent-neon'
              : 'border-accent-gold/30 bg-accent-gold/10 text-accent-gold')
          }
        >
          <span className={'h-1.5 w-1.5 rounded-full ' + (isActive ? 'bg-accent-neon' : 'bg-accent-gold')} aria-hidden="true" />
          {isActive ? 'Finalisé' : 'Ouvert'}
        </span>
        <div className="text-right">
          <p className="text-[11px] text-ink-400">Your share</p>
          <p className="font-mono text-sm font-bold text-accent-violet">
            {pact.myShareBps > 0 ? `${sharePct}%` : '—'}
          </p>
        </div>
      </div>

      <h3 className="font-sans text-base font-semibold text-white">{pact.title}</h3>
      <p className="mt-0.5 font-mono text-xs text-ink-400">
        Creator : {truncateAddress(pact.creator.toBase58())}
      </p>

      {/* Vault / quote-part */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[11px] text-ink-400">Your claimable</p>
          <p className="mt-1 font-mono text-base font-bold tabular-nums text-accent-neon">
            {pact.myClaimableSol.toFixed(4)} <span className="text-xs">SOL</span>
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[11px] text-ink-400">Vault balance</p>
          <p className="mt-1 font-mono text-base font-bold tabular-nums text-white">
            {pact.vaultBalanceSol.toFixed(4)} <span className="text-xs text-ink-400">SOL</span>
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-400">
        {pact.members.length} membre(s) · {approvedCount}/{pact.members.length} approbations
      </p>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDistribute(pact)}
          disabled={distributeDisabled}
          title={distributeReason}
          aria-label={`Distribuer le vault de ${pact.title}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-neon px-4 text-sm font-semibold text-ink-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {distributing ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/30 border-t-ink-900" aria-hidden="true" />
              Distribution…
            </>
          ) : (
            `Distribute ${pact.vaultBalanceSol.toFixed(2)} SOL`
          )}
        </button>
        <button
          type="button"
          onClick={() => setFundOpen((v) => !v)}
          disabled={!walletConnected || busyAction !== null}
          aria-expanded={fundOpen}
          className="inline-flex h-11 items-center rounded-xl border border-white/10 px-3 text-sm text-ink-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Fund
        </button>
        {!isActive && (
          <button
            type="button"
            onClick={() => onFinalize(pact)}
            disabled={!canFinalize}
            title={
              !walletConnected
                ? 'Connectez votre wallet'
                : !allApproved
                  ? 'Tous les membres doivent approuver avant de finaliser'
                  : 'Verrouille le projet on-chain'
            }
            className="inline-flex h-11 items-center rounded-xl bg-accent-violet px-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {finalizing ? '…' : '🔒 Finaliser'}
          </button>
        )}
      </div>

      {/* Mini-form Fund */}
      {fundOpen && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-2">
          <input
            type="number"
            min="0.001"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Montant en SOL"
            className="h-10 w-full rounded-lg border border-white/10 bg-base-800 px-3 font-mono text-sm text-white outline-none focus:border-accent-violet"
          />
          <button
            type="button"
            onClick={confirmFund}
            disabled={funding}
            className="h-10 shrink-0 rounded-lg bg-accent-violet px-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {funding ? '…' : 'OK'}
          </button>
          <button
            type="button"
            onClick={() => setFundOpen(false)}
            className="h-10 shrink-0 rounded-lg px-2 text-sm text-ink-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </article>
  );
}

export default PactCard;

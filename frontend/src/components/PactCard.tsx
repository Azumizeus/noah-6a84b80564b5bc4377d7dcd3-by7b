import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { formatSol, formatAddress } from '../lib/pacts';
import type { Pact, PactAction } from '../types/pact';
import AddMemberModal from './AddMemberModal';

interface Props {
  pact: Pact;
  walletConnected: boolean;
  busyAction: PactAction | null;
  onDistribute: (pact: Pact) => void;
  onFund: (pact: Pact, amount: number) => void;
  onFinalize: (pact: Pact) => void;
}

export default function PactCard({ pact, walletConnected, busyAction, onDistribute, onFund, onFinalize }: Props) {
  const [fundAmount, setFundAmount] = useState('0.1');
  const [showAddMember, setShowAddMember] = useState(false);

  const statusColor = pact.status === 'active' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-amber-400 border-amber-400/30 bg-amber-400/10';
  const statusLabel = pact.status === 'active' ? 'Finalisé' : 'Ouvert';

  const canFinalize = pact.memberCount >= 2;
  const canDistribute = pact.vaultBalanceSol > 0;

  return (
    <>
      <article className="glass-panel group relative overflow-hidden rounded-2xl border border-white/5 p-6 transition-all hover:border-accent-violet/20">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-sans text-lg font-semibold text-white">{pact.title}</h3>
            <p className="mt-1 font-mono text-xs text-ink-400">Creator: {formatAddress(pact.creator.toBase58())}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div>
            <p className="text-xs text-ink-400">Your claimable</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-accent-neon">{formatSol(pact.myClaimableSol)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Vault balance</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-white">{formatSol(pact.vaultBalanceSol)} SOL</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Your share</p>
            <p className="mt-0.5 font-mono text-sm text-white">{(pact.myShareBps / 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Members</p>
            <p className="mt-0.5 font-mono text-sm text-white">{pact.memberCount} membre(s)</p>
          </div>
        </div>

        {walletConnected && (
          <div className="mt-6 space-y-3 border-t border-white/5 pt-4">
            {!pact.finalized && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowAddMember(true)}
                  disabled={busyAction !== null}
                  className="w-full rounded-lg border border-purple-500/50 bg-purple-500/10 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                >
                  + Ajouter membre
                </button>
                <div className="text-xs text-ink-400">
                  {pact.memberCount < 2 && '⚠️ Minimum 2 membres requis pour finaliser'}
                </div>
              </div>
            )}

            {pact.finalized && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-accent-violet/50 focus:outline-none"
                  placeholder="Amount SOL"
                />
                <button
                  onClick={() => onFund(pact, parseFloat(fundAmount))}
                  disabled={busyAction !== null}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busyAction === 'Fund' ? 'Funding...' : 'Fund'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {!pact.finalized ? (
                <button
                  onClick={() => onFinalize(pact)}
                  disabled={busyAction !== null || !canFinalize}
                  className="flex-1 rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/90 disabled:opacity-50"
                  title={!canFinalize ? 'Ajoute au moins 2 membres' : ''}
                >
                  {busyAction === 'Finalize' ? 'Finalisation...' : '🔒 Finaliser'}
                </button>
              ) : (
                <button
                  onClick={() => onDistribute(pact)}
                  disabled={busyAction !== null || !canDistribute}
                  className="flex-1 rounded-lg bg-accent-neon px-4 py-2 text-sm font-bold text-ink-900 transition hover:opacity-90 disabled:opacity-50"
                >
                  {busyAction === 'Distribute' ? 'Distribution...' : `Distribute ${formatSol(pact.vaultBalanceSol)} SOL`}
                </button>
              )}
            </div>
          </div>
        )}
      </article>

      {showAddMember && (
        <AddMemberModal
          projectPda={pact.pda}
          projectTitle={pact.title}
          onClose={() => setShowAddMember(false)}
          onSuccess={() => {
            setShowAddMember(false);
            // Le refresh se fera via usePactActions / onSuccess dans le parent
            window.location.reload(); // Simple et efficace pour le MVP
          }}
        />
      )}
    </>
  );
}

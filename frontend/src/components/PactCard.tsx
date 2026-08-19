import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { approve } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { formatSol, formatAddress, parseTxError } from '../lib/pacts';
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
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [fundAmount, setFundAmount] = useState('0.1');
  const [showAddMember, setShowAddMember] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const statusColor = pact.status === 'active' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-amber-400 border-amber-400/30 bg-amber-400/10';
  const statusLabel = pact.status === 'active' ? 'Finalisé' : 'Ouvert';

  const myAddr = publicKey?.toBase58();
  const me = pact.members.find((m) => m.wallet.toBase58() === myAddr);
  const iAmMember = !!me;
  const iHaveApproved = me?.approved ?? false;
  const iAmCreator = pact.creator.toBase58() === myAddr;
  const approvedCount = pact.members.filter((m) => m.approved).length;
  const allApproved = pact.members.length > 0 && pact.members.every((m) => m.approved);

  // Total des parts — le program exige EXACTEMENT 10000 bps (100%)
  const totalBps = pact.members.reduce((sum, m) => sum + m.shareBps, 0);
  const sharesComplete = totalBps === 10000;
  const totalPct = totalBps / 100;

  const canFinalize = pact.members.length >= 2 && allApproved && sharesComplete && iAmCreator;
  const canDistribute = pact.vaultBalanceSol > 0;

  const handleApprove = async () => {
    if (!publicKey || !program) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approve(program, publicKey, pact.pda);
      window.location.reload();
    } catch (e: any) {
      setApproveError(parseTxError(e));
    } finally {
      setApproving(false);
    }
  };

  const finalizeBlockReason = !iAmCreator
    ? 'Seul le founder peut finaliser'
    : pact.members.length < 2
      ? 'Ajoute au moins 2 membres'
      : !sharesComplete
        ? `Total des parts = ${totalPct.toFixed(2)}% — doit être exactement 100%`
        : !allApproved
          ? `${approvedCount}/${pact.members.length} approbations`
          : '';

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
            <p className="mt-0.5 font-mono text-sm text-white">{pact.members.length} membre(s)</p>
          </div>
        </div>

        {pact.members.length > 0 && (
          <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-black/30 p-3">
            {pact.members.map((m) => (
              <div key={m.wallet.toBase58()} className="flex items-center justify-between font-mono text-xs">
                <span className="text-ink-400">
                  {formatAddress(m.wallet.toBase58())} · {(m.shareBps / 100).toFixed(2)}%
                  {m.wallet.toBase58() === myAddr && <span className="ml-1 text-accent-violet">(toi)</span>}
                  {m.wallet.toBase58() === pact.creator.toBase58() && <span className="ml-1">👑</span>}
                </span>
                {pact.status !== 'active' && (
                  <span className={m.approved ? 'text-emerald-400' : 'text-amber-400'}>
                    {m.approved ? '✓ approuvé' : '⏳ en attente'}
                  </span>
                )}
              </div>
            ))}
            <div className={`flex justify-between border-t border-white/5 pt-1 font-mono text-xs font-bold ${sharesComplete ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>Total</span>
              <span>{totalPct.toFixed(2)}% {sharesComplete ? '✓' : '⚠️ doit = 100%'}</span>
            </div>
          </div>
        )}

        {walletConnected && (
          <div className="mt-6 space-y-3 border-t border-white/5 pt-4">
            {pact.status !== 'active' && (
              <div className="flex flex-col gap-2">
                {iAmMember && !iHaveApproved && (
                  <button
                    onClick={handleApprove}
                    disabled={approving || busyAction !== null}
                    className="w-full rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {approving ? 'Signature...' : '✅ Approuver ce pact'}
                  </button>
                )}
                {iAmMember && iHaveApproved && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2 text-center text-xs text-emerald-400">
                    ✓ Tu as approuvé ce pact
                  </div>
                )}
                {approveError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
                    {approveError}
                  </div>
                )}

                {/* Ajout de membre : réservé au founder, uniquement si pact ouvert */}
                {iAmCreator && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    disabled={busyAction !== null}
                    className="w-full rounded-lg border border-purple-500/50 bg-purple-500/10 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                  >
                    + Ajouter membre
                  </button>
                )}
                <div className="text-xs text-ink-400">
                  {finalizeBlockReason ? `⏳ ${finalizeBlockReason}` : '✅ Prêt à finaliser'}
                </div>
              </div>
            )}

            {pact.status === 'active' && (
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
                  {busyAction === 'fund' ? 'Funding...' : 'fund'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              {pact.status !== 'active' ? (
                iAmCreator ? (
                  <button
                    onClick={() => onFinalize(pact)}
                    disabled={busyAction !== null || !canFinalize}
                    className="flex-1 rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/90 disabled:opacity-50"
                    title={finalizeBlockReason}
                  >
                    {busyAction === 'finalize' ? 'Finalisation...' : '🔒 Finaliser (founder)'}
                  </button>
                ) : (
                  <div className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-center text-xs text-ink-400">
                    🔒 Seul le founder peut finaliser et débloquer la rémunération
                  </div>
                )
              ) : (
                <button
                  onClick={() => onDistribute(pact)}
                  disabled={busyAction !== null || !canDistribute}
                  className="flex-1 rounded-lg bg-accent-neon px-4 py-2 text-sm font-bold text-ink-900 transition hover:opacity-90 disabled:opacity-50"
                >
                  {busyAction === 'distribute' ? 'Distribution...' : `Distribute ${formatSol(pact.vaultBalanceSol)} SOL`}
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
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

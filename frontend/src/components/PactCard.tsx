import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { approve, distributeWithReceipt } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { formatSol, formatAddress, parseTxError } from '../lib/pacts';
import type { Pact, PactAction, DistributionReceipt } from '../types/pact';
import AddMemberModal from './AddMemberModal';

interface Props {
  pact: Pact;
  walletConnected: boolean;
  busyAction: PactAction | null;
  onFund: (pact: Pact, amount: number) => void;
  onFinalize: (pact: Pact) => void;
  /** @deprecated — distribute géré en interne (reçu signé). Prop conservée pour compat parent, ignorée. */
  onDistribute?: (pact: Pact) => void;
}

// ─── Reçus de distribution persistés en sessionStorage (survit à un reload) ───
const RECEIPTS_KEY = 'buildpact-distribution-receipts';

function loadReceipts(): Record<string, DistributionReceipt> {
  try {
    const raw = sessionStorage.getItem(RECEIPTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DistributionReceipt>) : {};
  } catch {
    return {};
  }
}

function saveReceipt(
  pdaKey: string,
  receipt: DistributionReceipt
): Record<string, DistributionReceipt> {
  const all = loadReceipts();
  all[pdaKey] = receipt;
  try {
    sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(all));
  } catch {
    /* stockage plein/refusé → non bloquant, reçu conservé en mémoire */
  }
  return all;
}

function clearReceipt(pdaKey: string): Record<string, DistributionReceipt> {
  const all = loadReceipts();
  delete all[pdaKey];
  try {
    sessionStorage.setItem(RECEIPTS_KEY, JSON.stringify(all));
  } catch {
    /* idem */
  }
  return all;
}

export default function PactCard({
  pact,
  walletConnected,
  busyAction,
  onFund,
  onFinalize,
}: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [fundAmount, setFundAmount] = useState('0.1');
  const [showAddMember, setShowAddMember] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [distributeError, setDistributeError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, DistributionReceipt>>(
    () => loadReceipts()
  );

  const pdaKey = pact.pda.toBase58();
  const receipt = receipts[pdaKey];
  const busy = busyAction !== null;

  const statusColor =
    pact.status === 'active'
      ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
      : 'text-amber-400 border-amber-400/30 bg-amber-400/10';
  const statusLabel = pact.status === 'active' ? 'Finalisé' : 'Ouvert';

  const myAddr = publicKey?.toBase58();
  const me = pact.members.find((m) => m.wallet.toBase58() === myAddr);
  const iAmMember = !!me;
  const iHaveApproved = me?.approved ?? false;
  const iAmCreator = pact.creator.toBase58() === myAddr;
  const approvedCount = pact.members.filter((m) => m.approved).length;
  const allApproved =
    pact.members.length > 0 && pact.members.every((m) => m.approved);

  // Total des parts — le program exige EXACTEMENT 10000 bps (100%)
  const totalBps = pact.members.reduce((sum, m) => sum + m.shareBps, 0);
  const sharesComplete = totalBps === 10000;
  const totalPct = totalBps / 100;

  const canFinalize =
    pact.members.length >= 2 && allApproved && sharesComplete && iAmCreator;
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

  const handleDistribute = async () => {
    if (!publicKey || !program) return;
    setDistributing(true);
    setDistributeError(null);
    try {
      const r = await distributeWithReceipt(program, publicKey, pact);
      setReceipts(saveReceipt(pdaKey, r));
    } catch (e: any) {
      setDistributeError(parseTxError(e));
    } finally {
      setDistributing(false);
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
            <h3 className="font-sans text-lg font-semibold text-white">
              {pact.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-ink-400">
              Creator: {formatAddress(pact.creator.toBase58())}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div>
            <p className="text-xs text-ink-400">Your claimable</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-accent-neon">
              {formatSol(pact.myClaimableSol)} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Vault balance</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-white">
              {formatSol(pact.vaultBalanceSol)} SOL
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Your share</p>
            <p className="mt-0.5 font-mono text-sm text-white">
              {(pact.myShareBps / 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Members</p>
            <p className="mt-0.5 font-mono text-sm text-white">
              {pact.members.length} membre(s)
            </p>
          </div>
        </div>

        {pact.members.length > 0 && (
          <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-black/30 p-3">
            {pact.members.map((m) => (
              <div
                key={m.wallet.toBase58()}
                className="flex items-center justify-between font-mono text-xs"
              >
                <span className="text-ink-400">
                  {formatAddress(m.wallet.toBase58())} ·{' '}
                  {(m.shareBps / 100).toFixed(2)}%
                  {m.wallet.toBase58() === myAddr && (
                    <span className="ml-1 text-accent-violet">(toi)</span>
                  )}
                  {m.wallet.toBase58() === pact.creator.toBase58() && (
                    <span className="ml-1">👑</span>
                  )}
                </span>
                {pact.status !== 'active' && (
                  <span
                    className={
                      m.approved ? 'text-emerald-400' : 'text-amber-400'
                    }
                  >
                    {m.approved ? '✓ approuvé' : '⏳ en attente'}
                  </span>
                )}
              </div>
            ))}
            <div
              className={`flex justify-between border-t border-white/5 pt-1 font-mono text-xs font-bold ${
                sharesComplete ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              <span>Total</span>
              <span>
                {totalPct.toFixed(2)}%{' '}
                {sharesComplete ? '✓' : '⚠️ doit = 100%'}
              </span>
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
                    disabled={approving || busy}
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

                {iAmCreator && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    disabled={busy}
                    className="w-full rounded-lg border border-purple-500/50 bg-purple-500/10 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                  >
                    + Ajouter membre
                  </button>
                )}
                <div className="text-xs text-ink-400">
                  {finalizeBlockReason
                    ? `⏳ ${finalizeBlockReason}`
                    : '✅ Prêt à finaliser'}
                </div>
              </div>
            )}

            {pact.status === 'active' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="flex-1 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-accent-violet/50 focus:outline-none"
                    placeholder="Montant SOL"
                  />
                  <button
                    onClick={() => onFund(pact, parseFloat(fundAmount))}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busyAction === 'fund'
                      ? 'Envoi...'
                      : '💚 Soutenir ce projet'}
                  </button>
                </div>
                <p className="text-center text-xs text-ink-400">
                  Grant on-chain — les fonds sont splités automatiquement entre les membres selon leurs parts (2% protocole)
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {pact.status !== 'active' ? (
                iAmCreator ? (
                  <button
                    onClick={() => onFinalize(pact)}
                    disabled={busy || !canFinalize}
                    className="flex-1 rounded-lg bg-accent-violet px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-violet/90 disabled:opacity-50"
                    title={finalizeBlockReason}
                  >
                    {busyAction === 'finalize'
                      ? 'Finalisation...'
                      : '🔒 Finaliser (founder)'}
                  </button>
                ) : (
                  <div className="flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-center text-xs text-ink-400">
                    🔒 Seul le founder peut finaliser et débloquer la
                    rémunération
                  </div>
                )
              ) : (
                <div className="flex-1 space-y-1">
                  <button
                    onClick={handleDistribute}
                    disabled={busy || distributing || !canDistribute}
                    aria-describedby={`distrib-hint-${pdaKey}`}
                    className="w-full rounded-lg bg-accent-neon px-4 py-2 text-sm font-bold text-ink-900 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {distributing
                      ? 'Distribution...'
                      : `Distribuer ${formatSol(pact.vaultBalanceSol)} SOL aux membres`}
                  </button>
                  <p
                    id={`distrib-hint-${pdaKey}`}
                    className="text-center text-xs text-ink-400"
                  >
                    Split automatique : 2% protocole · 98% pro-rata des parts →
                    wallets des membres
                  </p>
                  {distributeError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-400">
                      {distributeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {receipt && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">
                ✓ Distribution exécutée
              </span>
              <button
                onClick={() => setReceipts(clearReceipt(pdaKey))}
                aria-label="Fermer le reçu de distribution"
                className="text-ink-400 transition hover:text-white"
              >
                ×
              </button>
            </div>
            <a
              href={`https://solscan.io/tx/${receipt.signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-accent-violet underline"
            >
              Voir la transaction sur Solscan ↗
            </a>
            <ul className="mt-2 space-y-1">
              {receipt.payouts.map((p) => (
                <li
                  key={p.wallet}
                  className="flex justify-between font-mono text-xs"
                >
                  <span className="text-ink-400">
                    {formatAddress(p.wallet)} · {(p.shareBps / 100).toFixed(2)}%
                  </span>
                  <span className="text-emerald-400">
                    +{formatSol(p.amountSol)} SOL
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-white/5 pt-1 font-mono text-xs">
                <span className="text-ink-400">Protocole (2%)</span>
                <span className="text-white">
                  +{formatSol(receipt.feeSol)} SOL
                </span>
              </li>
            </ul>
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

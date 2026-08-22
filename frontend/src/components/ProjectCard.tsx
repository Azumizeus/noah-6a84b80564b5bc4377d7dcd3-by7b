import { useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { approve, finalize, fund, distribute } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
<<<<<<< HEAD
import { parseTxError, formatSol, getVaultBalance } from '../lib/pacts';
=======
import { parseTxError, formatSol, getVaultBalance, explorerTxUrl } from '../lib/pacts';
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
import { BN } from '@coral-xyz/anchor';
import AddMemberModal from './AddMemberModal';

interface Props {
  project: any;
  projectPda: PublicKey;
  onUpdate: () => void;
}

export default function ProjectCard({ project, projectPda, onUpdate }: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
<<<<<<< HEAD
=======
  const [successSig, setSuccessSig] = useState<string | null>(null);
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
  const [showAddMember, setShowAddMember] = useState(false);

  const isCreator = publicKey && project.creator.equals(publicKey);
  const isMember = publicKey && project.members.some((m: any) => m.wallet.equals(publicKey));
  const myMemberData = isMember ? project.members.find((m: any) => m.wallet.equals(publicKey)) : null;
  const hasApproved = myMemberData?.approved ?? false;

  const totalApprovals = project.members.filter((m: any) => m.approved).length;
  const totalMembers = project.members.length;

  const handleAction = async (action: string, fn: () => Promise<any>) => {
    if (!publicKey || !program) return;
    setLoading(action);
    setError(null);
    setSuccess(null);
<<<<<<< HEAD
    try {
      const result = await fn();
      setSuccess(`${action} réussi !`);
      setTimeout(() => {
        onUpdate();
        setSuccess(null);
      }, 2000);
=======
    setSuccessSig(null);
    try {
      // fn() renvoie la signature de transaction (string) pour approve/finalize/fund/distribute.
      // On la garde affichée avec le lien Explorer — on ne l'efface plus automatiquement,
      // sinon le lien disparaît avant que l'utilisateur ait pu cliquer dessus.
      const sig: string = await fn();
      setSuccess(`${action} réussi !`);
      if (typeof sig === 'string') setSuccessSig(sig);
      onUpdate();
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
    } catch (e: any) {
      setError(parseTxError(e));
    } finally {
      setLoading(null);
    }
  };

  const handleApprove = () =>
    handleAction('Approve', () => approve(program, publicKey!, projectPda));

  const handleFinalize = () =>
    handleAction('Finalize', () => finalize(program, publicKey!, projectPda));

  const handleFund = async () => {
    const amount = prompt('Montant à funder (SOL) :', '0.1');
    if (!amount) return;
    const lamports = new BN(parseFloat(amount) * 1e9);
    await handleAction('Fund', () => fund(program, publicKey!, projectPda, lamports));
  };

  const handleDistribute = () =>
    handleAction('Distribute', async () => {
      const vaultBalance = await getVaultBalance(projectPda);
      if (vaultBalance === 0) throw new Error('Vault vide');
      const memberWallets = project.members.map((m: any) => m.wallet);
      return distribute(program, publicKey!, projectPda, project.protocolWallet, memberWallets);
    });

  return (
    <>
      <div className="bg-[#0a0a12] border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  project.finalized ? 'bg-green-400' : 'bg-yellow-400'
                }`}
              />
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {project.finalized ? 'Finalisé' : 'Ouvert'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">{project.title}</h3>
            <p className="text-sm text-gray-500">
              Creator : {project.creator.toBase58().slice(0, 4)}...{project.creator.toBase58().slice(-4)}
            </p>
          </div>
          {myMemberData && (
            <div className="text-right">
              <div className="text-xs text-gray-400">Your share</div>
              <div className="text-lg font-bold text-purple-400">
                {(myMemberData.shareBps / 100).toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-xs text-gray-400">Your claimable</div>
            <div className="text-lg font-bold text-white">
              {myMemberData ? formatSol(myMemberData.claimable) : '0.000'} SOL
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-xs text-gray-400">Vault balance</div>
            <div className="text-lg font-bold text-white">
              {formatSol(project.vaultBalance)} SOL
            </div>
          </div>
        </div>

        {/* Members info */}
        <div className="text-sm text-gray-400 mb-4">
          {totalMembers} membre(s) · {totalApprovals}/{totalMembers} approbations
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-400 mb-4">
<<<<<<< HEAD
            {success}
=======
            <div className="flex items-center justify-between gap-2">
              <span>✅ {success}</span>
              <button
                onClick={() => { setSuccess(null); setSuccessSig(null); }}
                className="text-xs text-green-300 hover:text-white"
              >
                ✕
              </button>
            </div>
            {successSig && (
              <a
                href={explorerTxUrl(successSig)}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-[11px] text-green-300 underline underline-offset-2 hover:opacity-80"
              >
                Voir la transaction sur Solana Explorer : {successSig.slice(0, 8)}… ↗
              </a>
            )}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {isMember && !hasApproved && !project.finalized && (
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
            >
              {loading === 'Approve' ? 'Approbation...' : 'Approuver'}
            </button>
          )}

          {isCreator && !project.finalized && (
            <>
              <button
                onClick={() => setShowAddMember(true)}
                disabled={loading !== null}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
              >
                + Membre
              </button>
              <button
                onClick={handleFinalize}
                disabled={loading !== null || totalMembers < 2}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
                title={totalMembers < 2 ? 'Minimum 2 membres requis' : ''}
              >
                {loading === 'Finalize' ? 'Finalisation...' : '🔒 Finaliser'}
              </button>
            </>
          )}

          {project.finalized && (
            <>
              <button
                onClick={handleFund}
                disabled={loading !== null}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
              >
                {loading === 'Fund' ? 'Funding...' : 'Fund'}
              </button>
<<<<<<< HEAD
              <button
                onClick={handleDistribute}
                disabled={loading !== null || project.vaultBalance === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
              >
                {loading === 'Distribute' ? 'Distribution...' : `Distribute ${formatSol(project.vaultBalance)} SOL`}
              </button>
=======
              {isCreator && (
                <button
                  onClick={handleDistribute}
                  disabled={loading !== null || project.vaultBalance === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-50"
                >
                  {loading === 'Distribute' ? 'Distribution...' : `Distribute ${formatSol(project.vaultBalance)} SOL`}
                </button>
              )}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
            </>
          )}
        </div>
      </div>

      {showAddMember && (
        <AddMemberModal
          projectPda={projectPda}
          projectTitle={project.title}
<<<<<<< HEAD
=======
          existingMembers={project.members}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          onClose={() => setShowAddMember(false)}
          onSuccess={onUpdate}
        />
      )}
    </>
  );
}

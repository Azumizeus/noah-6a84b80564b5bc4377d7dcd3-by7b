import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { addMember } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { parseTxError } from '../lib/pacts';

interface Props {
  projectPda: PublicKey;
  projectTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMemberModal({ projectPda, projectTitle, onClose, onSuccess }: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [wallet, setWallet] = useState('');
  const [role, setRole] = useState('member');
  const [share, setShare] = useState('20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !program) return;

    setLoading(true);
    setError(null);

    try {
      const memberWallet = new PublicKey(wallet.trim());
      const shareBps = Math.round(parseFloat(share) * 100);

      if (shareBps <= 0 || shareBps > 10000) {
        throw new Error('Le share doit etre entre 0.01% et 100%');
      }

      await addMember(program, publicKey, projectPda, memberWallet, role.slice(0, 24), shareBps);

      onSuccess();
      onClose();
    } catch (e: any) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d15] border border-purple-500/30 rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Ajouter un membre</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Projet : <span className="text-purple-400">{projectTitle}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Adresse wallet du membre</label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="DMg5KfHSSgYnUd4rzFULE4SDF4s25NJ9vkypoiAv2hxa"
              className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Role (max 24 caracteres)</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              maxLength={24}
              className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Part (%)</label>
            <input
              type="number"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              min="0.01"
              max="100"
              step="0.01"
              className="w-full bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm font-medium"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

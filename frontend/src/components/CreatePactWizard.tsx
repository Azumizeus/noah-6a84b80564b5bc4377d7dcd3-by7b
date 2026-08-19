// src/components/CreatePactWizard.tsx
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createProject, addMember, approve, finalize } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { parseTxError } from '../lib/pacts';

interface Props {
  onSuccess: () => void;
}

interface MemberDraft {
  wallet: string;
  role: string;
  share: number;
}

const STAGES = [
  { id: 'dev', label: '🔧 Recherche des devs' },
  { id: 'invest', label: '💰 Recherche des investisseurs' },
  { id: 'both', label: '🤝 Les deux' },
] as const;

export function CreatePactWizard({ onSuccess }: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState('Founder');
  const [myShare, setMyShare] = useState(50);
  const [stage, setStage] = useState<string>('both');
  const [protocolWallet, setProtocolWallet] = useState('');
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const [projectPda, setProjectPda] = useState<PublicKey | null>(null);
  const [projectId, setProjectId] = useState('');

  if (!publicKey || !program) {
    return <p className="text-ink-300">Connectez votre wallet</p>;
  }

  const totalShares = myShare + members.reduce((acc, m) => acc + (m.share || 0), 0);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const stageLabel = STAGES.find((s) => s.id === stage)?.label ?? stage;
      const id = 'pact-' + Date.now();
      const fullDescription = '[' + stageLabel + '] ' + description;
      const creatorShareBps = myShare * 100;

      const { projectPda: pda } = await createProject(
        program,
        publicKey,
        id,
        title,
        fullDescription,
        myRole,
        creatorShareBps,
        new PublicKey(protocolWallet)
      );

      setProjectId(id);
      setProjectPda(pda);
      setStep(2);
    } catch (e) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!projectPda) return;
    setLoading(true);
    setError(null);
    try {
      const validMembers = members.filter((m) => m.wallet.trim() !== '');
      for (const m of validMembers) {
        await addMember(
          program,
          publicKey,
          projectPda,
          new PublicKey(m.wallet),
          m.role,
          m.share * 100
        );
      }
      setStep(3);
    } catch (e) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!projectPda) return;
    setLoading(true);
    setError(null);
    try {
      await approve(program, publicKey, projectPda);
      await finalize(program, publicKey, projectPda);
      onSuccess();
    } catch (e) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
    }
  };

  const updateMember = (index: number, field: keyof MemberDraft, value: string | number) => {
    const next = [...members];
    next[index] = { ...next[index], [field]: value };
    setMembers(next);
  };

  return (
    <div className="glass-panel mx-auto max-w-lg p-6">
      <h2 className="mb-1 text-xl font-bold text-white">Créer un Pact</h2>
      <p className="mb-4 text-xs text-ink-400">Étape {step} / 3</p>

      {step === 1 && (
        <div className="space-y-4">
          <input
            className="w-full rounded border border-white/10 bg-base-800 p-2 text-white"
            placeholder="Titre du projet (ex: App mobile DeFi)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="w-full rounded border border-white/10 bg-base-800 p-2 text-white"
            rows={3}
            placeholder="Description claire : c'est quoi le projet, dans quoi les gens investissent ou sur quoi ils vont bosser"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div>
            <p className="mb-1 text-xs text-ink-400">Le projet cherche :</p>
            <div className="flex gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStage(s.id)}
                  className={
                    'flex-1 rounded-lg border px-2 py-2 text-xs transition-colors ' +
                    (stage === s.id
                      ? 'border-accent-violet/50 bg-violet-500/15 text-white'
                      : 'border-white/10 text-ink-300 hover:text-white')
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <input
            className="w-full rounded border border-white/10 bg-base-800 p-2 text-white"
            placeholder="Ton rôle (ex: Founder)"
            value={myRole}
            onChange={(e) => setMyRole(e.target.value)}
          />

          <div>
            <label className="text-xs text-ink-400">Ta part (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded border border-white/10 bg-base-800 p-2 text-white"
              value={myShare}
              onChange={(e) => setMyShare(Number(e.target.value))}
            />
          </div>

          <input
            className="w-full rounded border border-white/10 bg-base-800 p-2 text-white"
            placeholder="Adresse wallet protocole (reçoit les fees)"
            value={protocolWallet}
            onChange={(e) => setProtocolWallet(e.target.value)}
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !title || !protocolWallet}
            className="w-full rounded bg-accent-neon py-2 font-bold text-ink-900 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le projet'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-green-400">Projet créé ! ID : {projectId}</p>
          <p className="text-xs text-ink-400">
            Ajoute des membres (devs, investisseurs...) avec leur rôle et leur part.
            Le total de toutes les parts doit faire exactement 100%.
          </p>

          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 rounded border border-white/10 bg-base-800 p-2 text-sm text-white"
                placeholder="Wallet address"
                value={m.wallet}
                onChange={(e) => updateMember(i, 'wallet', e.target.value)}
              />
              <input
                className="w-24 rounded border border-white/10 bg-base-800 p-2 text-sm text-white"
                placeholder="Rôle"
                value={m.role}
                onChange={(e) => updateMember(i, 'role', e.target.value)}
              />
              <input
                type="number"
                className="w-16 rounded border border-white/10 bg-base-800 p-2 text-sm text-white"
                placeholder="%"
                value={m.share}
                onChange={(e) => updateMember(i, 'share', Number(e.target.value))}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setMembers([...members, { wallet: '', role: '', share: 0 }])}
            className="text-sm text-accent-violet hover:underline"
          >
            + Ajouter un membre
          </button>

          <p
            className={
              'text-sm font-bold ' + (totalShares === 100 ? 'text-green-400' : 'text-amber-400')
            }
          >
            Total des parts : {totalShares}% {totalShares === 100 ? '✓' : '(doit être 100%)'}
          </p>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={loading || totalShares !== 100}
            className="w-full rounded bg-accent-violet py-2 font-bold text-white disabled:opacity-50"
          >
            {loading ? 'Ajout...' : members.length > 0 ? 'Ajouter les membres' : 'Continuer (aucun membre)'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">Membres enregistrés !</p>
          <p className="text-sm text-ink-300">
            En production, chaque membre devra se connecter avec SON wallet pour approuver.
            Pour tester seul, clique ci-dessous (marche uniquement si tu es le seul membre).
          </p>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={loading}
            className="w-full rounded bg-accent-neon py-2 font-bold text-ink-900 disabled:opacity-50"
          >
            {loading ? 'Finalisation...' : 'Approuver & Finaliser (TEST)'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}

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

export function CreatePactWizard({ onSuccess }: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [myRole, setMyRole] = useState('Founder');
  const [myShare, setMyShare] = useState(50); // %
  const [protocolWallet, setProtocolWallet] = useState('');
  const [members, setMembers] = useState<Array<{ wallet: string; role: string; share: number }>>([]);

  // Project created state
  const [projectPda, setProjectPda] = useState<PublicKey | null>(null);
  const [projectId, setProjectId] = useState('');

  if (!publicKey || !program) {
    return <p className="text-ink-300">Connectez votre wallet</p>;
  }

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const id = `pact-${Date.now()}`;
      const creatorShareBps = myShare * 100; // % en basis points

      const { projectPda } = await createProject(
        program,
        publicKey,
        id,
        title,
        description,
        myRole,
        creatorShareBps,
        new PublicKey(protocolWallet)
      );

      setProjectId(id);
      setProjectPda(projectPda);
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
      for (const m of members) {
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
      // En vrai, chaque membre doit approve avec SON wallet
      // Ici on simule juste pour le test
      await approve(program, publicKey, projectPda);
      await finalize(program, publicKey, projectPda);
      onSuccess(); // Refresh la liste
    } catch (e) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">Créer un Pact</h2>

      {step === 1 && (
        <div className="space-y-4">
          <input
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Titre du projet"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Ton rôle (ex: Founder)"
            value={myRole}
            onChange={(e) => setMyRole(e.target.value)}
          />
          <div>
            <label className="text-xs text-ink-400">Ta part (%)</label>
            <input
              type="number"
              className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
              value={myShare}
              onChange={(e) => setMyShare(Number(e.target.value))}
            />
          </div>
          <input
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Adresse wallet protocole (reçoit les fees)"
            value={protocolWallet}
            onChange={(e) => setProtocolWallet(e.target.value)}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !title}
            className="w-full bg-accent-neon text-ink-900 font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le projet'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-green-400">Projet créé ! ID: {projectId}</p>
          <p className="text-xs text-ink-400">Ajoute des membres (laisse vide pour toi seul)</p>

          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="Wallet address"
                value={m.wallet}
                onChange={(e) => {
                  const newM = [...members];
                  newM[i].wallet = e.target.value;
                  setMembers(newM);
                }}
              />
              <input
                className="w-20 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="Role"
                value={m.role}
                onChange={(e) => {
                  const newM = [...members];
                  newM[i].role = e.target.value;
                  setMembers(newM);
                }}
              />
              <input
                type="number"
                className="w-20 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="%"
                value={m.share}
                onChange={(e) => {
                  const newM = [...members];
                  newM[i].share = Number(e.target.value);
                  setMembers(newM);
                }}
              />
            </div>
          ))}

          <button
            onClick={() => setMembers([...members, { wallet: '', role: '', share: 0 }])}
            className="text-sm text-accent-violet hover:underline"
          >
            + Ajouter un membre
          </button>

          <button
            onClick={handleAddMember}
            disabled={loading}
            className="w-full bg-accent-violet text-white font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Ajout...' : 'Ajouter les membres'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">Membres ajoutés !</p>
          <p className="text-sm text-ink-300">
            En production, chaque membre devra se connecter avec SON wallet pour approuver.
            Pour tester, clique ci-dessous pour approuver et finaliser.
          </p>
          <button
            onClick={handleFinalize}
            disabled={loading}
            className="w-full bg-accent-neon text-ink-900 font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Finalisation...' : 'Approuver & Finaliser (TEST)'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
}

  return (
    <div className="glass-panel p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white mb-4">Créer un Pact</h2>
      
      {step === 1 && (
        <div className="space-y-4">
          <input 
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Titre du projet"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea 
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <input 
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Ton rôle (ex: Founder)"
            value={myRole}
            onChange={e => setMyRole(e.target.value)}
          />
          <div>
            <label className="text-xs text-ink-400">Ta part (%)</label>
            <input 
              type="number"
              className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
              value={myShare}
              onChange={e => setMyShare(Number(e.target.value))}
            />
          </div>
          <input 
            className="w-full bg-base-800 border border-white/10 rounded p-2 text-white"
            placeholder="Adresse wallet protocole (reçoit les fees)"
            value={protocolWallet}
            onChange={e => setProtocolWallet(e.target.value)}
          />
          <button 
            onClick={handleCreate}
            disabled={loading || !title}
            className="w-full bg-accent-neon text-ink-900 font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le projet'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-green-400">Projet créé ! ID: {projectId}</p>
          <p className="text-xs text-ink-400">Ajoute des membres (laisse vide pour toi seul)</p>
          
          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input 
                className="flex-1 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="Wallet address"
                value={m.wallet}
                onChange={e => {
                  const newM = [...members];
                  newM[i].wallet = e.target.value;
                  setMembers(newM);
                }}
              />
              <input 
                className="w-20 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="Role"
                value={m.role}
                onChange={e => {
                  const newM = [...members];
                  newM[i].role = e.target.value;
                  setMembers(newM);
                }}
              />
              <input 
                type="number"
                className="w-20 bg-base-800 border border-white/10 rounded p-2 text-white text-sm"
                placeholder="%"
                value={m.share}
                onChange={e => {
                  const newM = [...members];
                  newM[i].share = Number(e.target.value);
                  setMembers(newM);
                }}
              />
            </div>
          ))}
          
          <button 
            onClick={() => setMembers([...members, {wallet: '', role: '', share: 0}])}
            className="text-sm text-accent-violet hover:underline"
          >
            + Ajouter un membre
          </button>
          
          <button 
            onClick={handleAddMember}
            disabled={loading}
            className="w-full bg-accent-violet text-white font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Ajout...' : 'Ajouter les membres'}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">Membres ajoutés !</p>
          <p className="text-sm text-ink-300">
            En production, chaque membre devra se connecter avec SON wallet pour approuver.
            Pour tester, clique ci-dessous pour approuver et finaliser.
          </p>
          <button 
            onClick={handleFinalize}
            disabled={loading}
            className="w-full bg-accent-neon text-ink-900 font-bold py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Finalisation...' : 'Approuver & Finaliser (TEST)'}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}

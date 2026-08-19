// src/components/CreatePactWizard.tsx
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createProject, addMember, approve, finalize } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { parseTxError } from '../lib/pacts';

// ═══ Wallet plateforme BuildPact — FIXE, non modifiable ═══
const PLATFORM_WALLET = 'AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH';

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

// Rôles possibles + poids (points de "travail apporté")
const ROLE_OPTIONS: { id: string; label: string; weight: number }[] = [
  { id: 'founder',   label: '👑 Founder',        weight: 15 },
  { id: 'leaddev',   label: '💻 Lead Dev',        weight: 15 },
  { id: 'dev',       label: '⌨️ Dev',             weight: 10 },
  { id: 'design',    label: '🎨 Designer',        weight: 8 },
  { id: 'marketing', label: '📣 Marketing',       weight: 8 },
  { id: 'community', label: '💬 Community Mgr',   weight: 5 },
  { id: 'bizdev',    label: '🤝 Biz Dev',         weight: 5 },
];

const inputCls = 'w-full rounded border border-white/10 bg-base-800 p-2 text-white';
const labelCls = 'block text-xs font-semibold text-white';
const hintCls = 'mt-1 block text-[11px] leading-snug text-ink-400';

// Calcule la part créateur suggérée selon les rôles cumulés + type de recherche
function suggestShare(roleIds: string[], stage: string): number {
  const totalWeight = roleIds
    .map((id) => ROLE_OPTIONS.find((r) => r.id === id)?.weight ?? 0)
    .reduce((a, b) => a + b, 0);

  // Base : poids des rôles, ramené à une échelle raisonnable
  let suggested = Math.round(totalWeight * 0.8);

  // Plafond selon ce que le projet cherche :
  // - cherche des devs → ils doivent avoir une grosse part → cap 40%
  // - cherche juste des investisseurs → cap 55% (l'argent ne "travaille" pas)
  const cap = stage === 'invest' ? 55 : 40;
  suggested = Math.min(Math.max(suggested, 10), cap);
  return suggested;
}

export function CreatePactWizard({ onSuccess }: Props) {
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['founder']);
  const [myShare, setMyShare] = useState(30);
  const [shareTouched, setShareTouched] = useState(false);
  const [stage, setStage] = useState<string>('both');
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const [projectPda, setProjectPda] = useState<PublicKey | null>(null);
  const [projectId, setProjectId] = useState('');

  if (!publicKey || !program) {
    return <p className="text-ink-300">Connectez votre wallet</p>;
  }

  const suggested = suggestShare(selectedRoles, stage);
  const effectiveShare = shareTouched ? myShare : suggested;
  const totalShares = effectiveShare + members.reduce((acc, m) => acc + (m.share || 0), 0);
  const remainingForMembers = 100 - effectiveShare;
  const cap = stage === 'invest' ? 55 : 40;
  const isGreedy = effectiveShare > cap;
  const myRoleLabel = selectedRoles
    .map((id) => ROLE_OPTIONS.find((r) => r.id === id)?.label ?? id)
    .join(' / ');

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) =>
      prev.includes(id)
        ? prev.filter((r) => r !== id)
        : [...prev, id]
    );
    // Recalcule la suggestion si l'user n'a pas modifié manuellement
    if (!shareTouched) {
      const next = selectedRoles.includes(id)
        ? selectedRoles.filter((r) => r !== id)
        : [...selectedRoles, id];
      setMyShare(suggestShare(next, stage));
    }
  };

  const handleStage = (id: string) => {
    setStage(id);
    if (!shareTouched) setMyShare(suggestShare(selectedRoles, id));
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const stageLabel = STAGES.find((s) => s.id === stage)?.label ?? stage;
      const id = 'pact-' + Date.now();
      const fullDescription = '[' + stageLabel + '] ' + description;
      const creatorShareBps = effectiveShare * 100;

      const { projectPda: pda } = await createProject(
        program,
        publicKey,
        id,
        title,
        fullDescription,
        myRoleLabel || 'Founder',
        creatorShareBps,
        new PublicKey(PLATFORM_WALLET)
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
      <p className="mb-1 text-xs text-ink-400">Étape {step} / 3</p>
      <p className="mb-4 text-xs text-ink-400">
        {step === 1 && '1️⃣ Décris ton projet et ta part — 2️⃣ Ajoute les membres — 3️⃣ Finalise on-chain'}
        {step === 2 && 'Projet créé on-chain ✅ — Maintenant, ajoute les membres du pact'}
        {step === 3 && 'Dernière étape : approbation et finalisation'}
      </p>

      {/* ═══════════ ÉTAPE 1 — IDENTITÉ ═══════════ */}
      {step === 1 && (
        <div className="space-y-4">

          {/* NOM */}
          <div>
            <label className={labelCls}>Nom du projet</label>
            <input
              className={inputCls}
              placeholder='Ex : "Seeker Mobile Game"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <small className={hintCls}>
              Nom court affiché dans la liste des pacts. Visible publiquement on-chain.
            </small>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder='Ex : "Jeu mobile space shooter sur Solana Seeker. Les revenus du jeu (achats in-app, NFT) alimentent le vault et sont reversés aux membres selon leurs parts."'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small className={hintCls}>
              Explique en 2-3 phrases : <strong>ce que fait le projet</strong>,{' '}
              <strong>d'où vient l'argent</strong> qui entrera dans le vault, et{' '}
              <strong>pourquoi quelqu'un devrait te rejoindre</strong>.
            </small>
          </div>

          {/* TYPE DE RECHERCHE */}
          <div>
            <label className={labelCls}>Le projet cherche :</label>
            <small className={hintCls}>
              Ce choix influence la part créateur maximum recommandée (les devs qui
              construisent méritent une vraie part).
            </small>
            <div className="mt-1 flex gap-2">
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStage(s.id)}
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

          {/* TES RÔLES (multi-sélection) */}
          <div>
            <label className={labelCls}>Tes rôles dans le projet</label>
            <small className={hintCls}>
              Sélectionne <strong>tous</strong> les rôles que tu assumes. Chaque rôle
              ajouté augmente ta part suggérée (tu travailles plus).
            </small>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={
                    'rounded-full border px-3 py-1 text-xs transition-colors ' +
                    (selectedRoles.includes(r.id)
                      ? 'border-accent-violet/60 bg-violet-500/20 text-white'
                      : 'border-white/10 text-ink-300 hover:text-white')
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
            {selectedRoles.length === 0 && (
              <small className="mt-1 block text-[11px] text-red-400">
                Sélectionne au moins un rôle.
              </small>
            )}
          </div>

          {/* TA PART — avec suggestion */}
          <div>
            <label className={labelCls}>Ta part (%) — créateur</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={effectiveShare}
                onChange={(e) => {
                  setShareTouched(true);
                  setMyShare(Number(e.target.value));
                }}
              />
              <button
                type="button"
                onClick={() => { setShareTouched(false); setMyShare(suggested); }}
                className="whitespace-nowrap rounded border border-accent-violet/40 bg-violet-500/10 px-3 py-2 text-xs text-accent-violet hover:bg-violet-500/20"
              >
                ✨ Suggéré : {suggested} %
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-[11px] leading-snug text-ink-300">
              💡 <strong className="text-white">Part suggérée : {suggested} %</strong>{' '}
              calculée selon tes {selectedRoles.length} rôle(s) et ce que le projet
              cherche. La somme de ta part + les membres (étape 2) doit faire{' '}
              <strong className="text-white">exactement 100 %</strong>.
              <br />
              À l'étape suivante, il te restera{' '}
              <strong className="text-white">{remainingForMembers} %</strong> à répartir.
            </div>

            {isGreedy && (
              <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] leading-snug text-amber-300">
                ⚠️ <strong>Part élevée ({effectiveShare} %).</strong> Au-delà de {cap} %
                alors que tu cherches des {stage === 'invest' ? 'investisseurs' : 'devs'},
                peu de gens rejoindront ton pact. Recommandé : {suggested} %.
              </div>
            )}

            <div className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] leading-snug text-emerald-300">
              🧮 <strong>Simulation :</strong> si le vault reçoit 10 SOL, tu toucheras{' '}
              <strong>{(effectiveShare / 10).toFixed(2)} SOL</strong> à chaque
              distribution (moins les frais plateforme).
            </div>
          </div>

          {/* WALLET PROTOCOLE — FIXE */}
          <div>
            <label className={labelCls}>Wallet des frais plateforme</label>
            <div className="flex items-center gap-2 rounded border border-white/10 bg-base-900/60 p-2">
              <span className="flex-1 truncate font-mono text-[11px] text-ink-400">
                {PLATFORM_WALLET}
              </span>
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-ink-400">
                🔒 Fixe
              </span>
            </div>
            <small className={hintCls}>
              Frais protocol BuildPact — prélevés automatiquement par le programme à
              chaque distribution. Non modifiable.
            </small>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !title || selectedRoles.length === 0}
            className="w-full rounded bg-accent-neon py-2 font-bold text-ink-900 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le projet on-chain'}
          </button>
        </div>
      )}

      {/* ═══════════ ÉTAPE 2 — MEMBRES ═══════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-green-400">Projet créé ! ID : {projectId}</p>
          <p className="text-xs text-ink-400">
            Ajoute les membres du pact (devs, investisseurs...) avec leur rôle et leur
            part. Chacun devra approuver avec SON wallet.
          </p>

          <div className="rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-[11px] text-ink-300">
            💡 Ta part créateur : <strong className="text-white">{effectiveShare} %</strong> —
            il reste <strong className="text-white">{remainingForMembers} %</strong> à
            répartir entre les membres. Le total doit faire exactement 100 %.
          </div>

          {members.map((m, i) => (
            <div key={i} className="space-y-1">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-white/10 bg-base-800 p-2 text-sm text-white"
                  placeholder="Wallet address du membre"
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
              <small className={hintCls}>
                Ex : wallet Phantom du dev, rôle "Lead Dev", part 40 %
              </small>
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
              'text-sm font-bold ' +
              (totalShares === 100 ? 'text-green-400' : 'text-amber-400')
            }
          >
            Total des parts : {totalShares} %{' '}
            {totalShares === 100
              ? '✓'
              : `(il ${totalShares < 100 ? 'manque' : 'y a'} ${Math.abs(100 - totalShares)} % — doit être 100 %)`}
          </p>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={loading || totalShares !== 100}
            className="w-full rounded bg-accent-violet py-2 font-bold text-white disabled:opacity-50"
          >
            {loading
              ? 'Ajout...'
              : members.length > 0
                ? 'Ajouter les membres on-chain'
                : 'Continuer (aucun membre)'}
          </button>
        </div>
      )}

      {/* ═══════════ ÉTAPE 3 — FINALISATION ═══════════ */}
      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">Membres enregistrés !</p>
          <p className="text-sm text-ink-300">
            En production, chaque membre devra se connecter avec SON wallet pour
            approuver. Pour tester seul, clique ci-dessous (marche uniquement si tu es
            le seul membre).
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

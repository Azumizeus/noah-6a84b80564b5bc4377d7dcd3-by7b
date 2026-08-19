// src/components/CreatePactWizard.tsx
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createProject, addMember, approve, finalize } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { parseTxError } from '../lib/pacts';

// ═══ Wallet plateforme BuildPact — FIXE, non modifiable ═══
// Pour le changer : modifie cette constante + commit + redeploy.
const PLATFORM_WALLET = 'AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH';

interface Props {
  onSuccess: () => void;
}

interface MemberDraft {
  wallet: string;
  role: string;
  share: number;
}

// ═══ Brouillon localStorage — survit à la fermeture de page ═══
interface PactDraft {
  step: number;
  title: string;
  description: string;
  selectedRoles: string[];
  customRoles: string[];
  myShare: number;
  shareTouched: boolean;
  stage: string;
  seedAmount: string;
  members: MemberDraft[];
  projectId: string;
  projectPda: string;
  savedAt: number;
}

const draftKey = (wallet: string) => `buildpact_pact_draft_${wallet}`;

function loadDraft(wallet: string): PactDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(wallet));
    if (!raw) return null;
    const d = JSON.parse(raw) as PactDraft;
    if (!d || typeof d !== 'object' || !d.title) return null;
    // Expire après 7 jours
    if (Date.now() - d.savedAt > 7 * 24 * 3600 * 1000) return null;
    return d;
  } catch {
    return null;
  }
}

const STAGES = [
  { id: 'dev', label: '🔧 Recherche des devs' },
  { id: 'invest', label: '💰 Recherche des investisseurs' },
  { id: 'both', label: '🤝 Les deux' },
] as const;

// Vrais rôles Web3 / Web2, groupés par catégorie
const ROLE_GROUPS: {
  category: string;
  roles: { id: string; label: string; weight: number }[];
}[] = [
  {
    category: 'Direction',
    roles: [
      { id: 'founder',    label: '👑 Founder',           weight: 15 },
      { id: 'cofounder',  label: '🤝 Co-Founder',        weight: 12 },
      { id: 'pm',         label: '📋 Product Manager',   weight: 10 },
    ],
  },
  {
    category: 'Tech',
    roles: [
      { id: 'leaddev',    label: '💻 Lead Dev',          weight: 15 },
      { id: 'rustdev',    label: '🦀 Rust / Anchor Dev', weight: 15 },
      { id: 'frontend',   label: '🖥️ Frontend Dev',      weight: 10 },
      { id: 'backend',    label: '⚙️ Backend Dev',       weight: 10 },
      { id: 'fullstack',  label: '🔧 Fullstack Dev',     weight: 12 },
      { id: 'mobile',     label: '📱 Mobile Dev',        weight: 10 },
      { id: 'gamedev',    label: '🎮 Game Dev',          weight: 10 },
      { id: 'devops',     label: '🛠️ DevOps',            weight: 8 },
      { id: 'security',   label: '🔐 Security Auditor',  weight: 12 },
    ],
  },
  {
    category: 'Design & Créatif',
    roles: [
      { id: 'uxui',       label: '🎨 UX/UI Designer',    weight: 10 },
      { id: 'artist',     label: '🖌️ Artist / 3D',       weight: 8 },
      { id: 'motion',     label: '🎬 Motion Designer',   weight: 6 },
    ],
  },
  {
    category: 'Business & Growth',
    roles: [
      { id: 'tokenomics', label: '📊 Tokenomics Expert', weight: 10 },
      { id: 'marketing',  label: '📣 Marketing',         weight: 8 },
      { id: 'community',  label: '💬 Community Mgr',     weight: 5 },
      { id: 'growth',     label: '📈 Growth / BD',       weight: 8 },
      { id: 'content',    label: '✍️ Content Writer',    weight: 5 },
      { id: 'legal',      label: '⚖️ Legal Advisor',     weight: 6 },
    ],
  },
  {
    category: 'Capital',
    roles: [
      { id: 'investor',   label: '💰 Investisseur',      weight: 0 },
      { id: 'advisor',    label: '🧭 Advisor',           weight: 3 },
    ],
  },
];

const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles);

const inputCls = 'w-full rounded border border-white/10 bg-base-800 p-2 text-white';
const labelCls = 'block text-xs font-semibold text-white';
const hintCls = 'mt-1 block text-[11px] leading-snug text-ink-400';

// Calcule la part créateur suggérée selon les rôles cumulés + type de recherche
function suggestShare(roleIds: string[], customCount: number, stage: string): number {
  const baseWeight = roleIds
    .map((id) => ALL_ROLES.find((r) => r.id === id)?.weight ?? 0)
    .reduce((a, b) => a + b, 0);
  const totalWeight = baseWeight + customCount * 5;

  let suggested = Math.round(totalWeight * 0.8);
  const cap = stage === 'invest' ? 55 : 40;
  return Math.min(Math.max(suggested, 10), cap);
}

// Raccourcit un label rôle pour tenir dans MAX_ROLE_LEN (24 BYTES on-chain)
function roleShortLabel(id: string): string {
  const SHORT: Record<string, string> = {
    founder: 'Founder', cofounder: 'CoFounder', pm: 'PM',
    leaddev: 'Lead Dev', rustdev: 'Rust Dev', frontend: 'Frontend',
    backend: 'Backend', fullstack: 'Fullstack', mobile: 'Mobile',
    gamedev: 'Game Dev', devops: 'DevOps', security: 'Security',
    uxui: 'UX/UI', artist: 'Artist', motion: 'Motion',
    tokenomics: 'Tokenomics', marketing: 'Marketing', community: 'Community',
    growth: 'Growth', content: 'Content', legal: 'Legal',
    investor: 'Investor', advisor: 'Advisor',
  };
  return SHORT[id] ?? id.slice(0, 24);
}

// project_id safe : ≤ 20 bytes, minuscules, sans accents
function slugId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12) || 'pact';
  return `${slug}-${Date.now().toString(36).slice(-6)}`; // ex: "seeker-mobile-abc123"
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
  const [customRole, setCustomRole] = useState('');
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [myShare, setMyShare] = useState(30);
  const [shareTouched, setShareTouched] = useState(false);
  const [stage, setStage] = useState<string>('both');
  const [seedAmount, setSeedAmount] = useState<string>(''); // invest founder (informatif)
  const [members, setMembers] = useState<MemberDraft[]>([]);

  const [projectPda, setProjectPda] = useState<PublicKey | null>(null);
  const [projectId, setProjectId] = useState('');

  // Brouillon existant proposé à la reprise
  const [pendingDraft, setPendingDraft] = useState<PactDraft | null>(null);

  // ─── Restauration du brouillon au montage ───
  useEffect(() => {
    if (!publicKey) return;
    const d = loadDraft(publicKey.toBase58());
    if (d) setPendingDraft(d);
  }, [publicKey]);

  // ─── Sauvegarde automatique du brouillon à chaque changement ───
  useEffect(() => {
    if (!publicKey) return;
    // Ne sauvegarde que si quelque chose a été saisi
    if (!title && step === 1) return;
    const draft: PactDraft = {
      step, title, description, selectedRoles, customRoles,
      myShare, shareTouched, stage, seedAmount, members,
      projectId,
      projectPda: projectPda ? projectPda.toBase58() : '',
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(draftKey(publicKey.toBase58()), JSON.stringify(draft));
    } catch { /* quota plein : non bloquant */ }
  }, [publicKey, step, title, description, selectedRoles, customRoles,
      myShare, shareTouched, stage, seedAmount, members, projectId, projectPda]);

  const clearDraft = () => {
    if (!publicKey) return;
    try { localStorage.removeItem(draftKey(publicKey.toBase58())); } catch {}
    setPendingDraft(null);
  };

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setStep(pendingDraft.step);
    setTitle(pendingDraft.title);
    setDescription(pendingDraft.description);
    setSelectedRoles(pendingDraft.selectedRoles);
    setCustomRoles(pendingDraft.customRoles);
    setMyShare(pendingDraft.myShare);
    setShareTouched(pendingDraft.shareTouched);
    setStage(pendingDraft.stage);
    setSeedAmount(pendingDraft.seedAmount);
    setMembers(pendingDraft.members);
    setProjectId(pendingDraft.projectId);
    if (pendingDraft.projectPda) {
      try { setProjectPda(new PublicKey(pendingDraft.projectPda)); } catch {}
    }
    setPendingDraft(null);
  };

  if (!publicKey || !program) {
    return <p className="text-ink-300">Connectez votre wallet</p>;
  }

  const suggested = suggestShare(selectedRoles, customRoles.length, stage);
  const effectiveShare = shareTouched ? myShare : suggested;
  const totalShares = effectiveShare + members.reduce((acc, m) => acc + (m.share || 0), 0);
  const remainingForMembers = 100 - effectiveShare;
  const cap = stage === 'invest' ? 55 : 40;
  const isGreedy = effectiveShare > cap;
  const myRoleLabel = [
    ...selectedRoles.map((id) => ALL_ROLES.find((r) => r.id === id)?.label ?? id),
    ...customRoles,
  ].join(' / ');

  const toggleRole = (id: string) => {
    const next = selectedRoles.includes(id)
      ? selectedRoles.filter((r) => r !== id)
      : [...selectedRoles, id];
    setSelectedRoles(next);
    if (!shareTouched) setMyShare(suggestShare(next, customRoles.length, stage));
  };

  const addCustomRole = () => {
    const v = customRole.trim();
    if (v && !customRoles.includes(v)) {
      const next = [...customRoles, v];
      setCustomRoles(next);
      setCustomRole('');
      if (!shareTouched) setMyShare(suggestShare(selectedRoles, next.length, stage));
    }
  };

  const removeCustomRole = (r: string) => {
    const next = customRoles.filter((c) => c !== r);
    setCustomRoles(next);
    if (!shareTouched) setMyShare(suggestShare(selectedRoles, next.length, stage));
  };

  const handleStage = (id: string) => {
    setStage(id);
    if (!shareTouched) setMyShare(suggestShare(selectedRoles, customRoles.length, id));
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const stageLabel = STAGES.find((s) => s.id === stage)?.label ?? stage;
      const id = slugId(title); // ✅ ≤ 20 bytes garanti

      const seedInfo =
        seedAmount && Number(seedAmount) > 0
          ? ` | 💰 Seed founder : ${seedAmount} SOL (engagement annoncé)`
          : '';
      const fullDescription = (
        '[' + stageLabel + '] ' +
        description +
        ' | Rôles créateur : ' + myRoleLabel + // ✅ la liste COMPLÈTE part ici (280 max)
        seedInfo
      ).slice(0, 280);

      // ✅ UN SEUL rôle, court, ≤ 24 bytes pour le programme
      const creatorRoleOnChain = selectedRoles.length > 0
        ? roleShortLabel(selectedRoles[0])
        : (customRoles[0]?.slice(0, 24) ?? 'Founder');

      const creatorShareBps = effectiveShare * 100;

      const { projectPda: pda } = await createProject(
        program,
        publicKey,
        id,
        title.slice(0, 40),          // ✅ sécurité
        fullDescription,
        creatorRoleOnChain,
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
          m.role.slice(0, 24),   // ✅ un rôle membre > 24 bytes = même crash 6005
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
      // Le créateur est auto-approuvé on-chain → AlreadyApproved attendu, on l'ignore
      try {
        await approve(program, publicKey, projectPda);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // 6010 = AlreadyApproved (custom error Anchor), 0x177a = hex de 6010
        if (!msg.includes('6010') && !msg.includes('0x177a')) throw e;
      }
      await finalize(program, publicKey, projectPda);
      clearDraft();
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

      {/* ═══ Reprise de brouillon (page fermée = rien perdu) ═══ */}
      {pendingDraft && step === 1 && (
        <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3">
          <p className="text-[12px] font-semibold text-amber-300">
            📝 Brouillon trouvé : « {pendingDraft.title} »
            {pendingDraft.projectPda && ' (projet déjà créé on-chain)'}
          </p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            Tu peux reprendre exactement où tu en étais — aucune donnée ni frais perdus.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={resumeDraft}
              className="flex-1 rounded bg-amber-500 py-1.5 text-xs font-bold text-ink-900"
            >
              ▶ Reprendre le brouillon
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded border border-amber-400/40 px-3 py-1.5 text-xs text-amber-300"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

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

          {/* SEED FOUNDER (informatif) */}
          <div>
            <label className={labelCls}>Ton investissement initial (optionnel)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                placeholder="0"
                value={seedAmount}
                onChange={(e) => setSeedAmount(e.target.value)}
              />
              <span className="whitespace-nowrap text-xs text-ink-400">SOL</span>
            </div>
            <small className={hintCls}>
              💡 Le contrat actuel ne stocke pas de dépôt initial — cette somme sera
              affichée dans la description comme <strong>engagement annoncé</strong>.
              Tu pourras ensuite l'envoyer réellement via le bouton "Fund" du pact.
              Une fonction de dépôt natif viendra dans une v2 du programme.
            </small>
          </div>

          {/* TES RÔLES (multi-sélection, groupés) */}
          <div>
            <label className={labelCls}>Tes rôles dans le projet</label>
            <small className={hintCls}>
              Sélectionne <strong>tous</strong> les rôles que tu assumes réellement.
              Chaque rôle augmente ta part suggérée (tu travailles plus).
            </small>

            {ROLE_GROUPS.map((group) => (
              <div key={group.category} className="mt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {group.category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.roles.map((r) => (
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
              </div>
            ))}

            {/* Rôle custom */}
            <div className="mt-3 flex gap-2">
              <input
                className={inputCls}
                placeholder='Autre rôle (ex : "Music Producer")'
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole(); } }}
              />
              <button
                type="button"
                onClick={addCustomRole}
                className="whitespace-nowrap rounded border border-accent-violet/40 bg-violet-500/10 px-3 text-xs text-accent-violet hover:bg-violet-500/20"
              >
                + Ajouter
              </button>
            </div>
            {customRoles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {customRoles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => removeCustomRole(r)}
                    className="rounded-full border border-accent-neon/50 bg-emerald-500/15 px-3 py-1 text-xs text-white"
                  >
                    {r} ✕
                  </button>
                ))}
              </div>
            )}

            {selectedRoles.length === 0 && customRoles.length === 0 && (
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
              calculée selon tes {selectedRoles.length + customRoles.length} rôle(s) et ce
              que le projet cherche. La somme de ta part + les membres (étape 2) doit
              faire <strong className="text-white">exactement 100 %</strong>.
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
              chaque distribution. Non modifiable par les utilisateurs.
            </small>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !title || (selectedRoles.length === 0 && customRoles.length === 0)}
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
            <br />
            ⚠️ Le programme exige <strong className="text-white">au moins 1 membre</strong>{' '}
            en plus du créateur (≥ 2 membres au total pour finaliser).
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

          {members.length === 0 && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-[11px] text-red-300">
              🚫 Impossible de continuer sans membre : le programme exige au moins 2
              membres (créateur inclus). Ajoute au moins un membre, même un second
              wallet à toi pour tester.
            </div>
          )}

          {members.length >= 8 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
              ⚠️ <strong>Limite technique :</strong> le programme actuel stocke les
              membres dans un seul compte on-chain. Au-delà de ~8-10 membres, le compte
              peut dépasser sa taille max. Pour les gros pacts (10+ membres), une
              évolution du smart contract sera nécessaire (comptes membres séparés).
            </div>
          )}

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
            disabled={loading || totalShares !== 100 || members.filter((m) => m.wallet.trim()).length === 0}
            className="w-full rounded bg-accent-violet py-2 font-bold text-white disabled:opacity-50"
          >
            {loading ? 'Ajout...' : 'Ajouter les membres on-chain'}
          </button>
        </div>
      )}

      {/* ═══════════ ÉTAPE 3 — FINALISATION ═══════════ */}
      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">Membres enregistrés !</p>
          <p className="text-sm text-ink-300">
            Chaque membre doit maintenant se connecter avec <strong>SON</strong> wallet
            et approuver depuis la carte du projet. Une fois toutes les approbations
            récoltées, le créateur finalise.
          </p>
          <div className="rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-left text-[11px] leading-snug text-ink-300">
            📋 <strong className="text-white">Prochaines actions :</strong>
            <br />1. Envoie le lien de la dApp aux membres
            <br />2. Chacun approuve avec son wallet (bouton "Approve" sur la carte)
            <br />3. Reviens ici et clique "Finaliser" — le pact devient actif
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={loading}
            className="w-full rounded bg-accent-neon py-2 font-bold text-ink-900 disabled:opacity-50"
          >
            {loading ? 'Finalisation...' : 'Finaliser le pact on-chain'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  )

// src/components/CreatePactWizard.tsx
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createProject, addMember } from '../lib/anchor';
import { useAnchorProgram } from '../hooks/useProjects';
import { parseTxError, explorerTxUrl } from '../lib/pacts';
import { ROLE_GROUPS, ALL_ROLES, roleShortLabel, combineRoleLabels } from '../lib/roles';
import { STAGE_CANONICAL, type PactStage } from '../lib/pitch';
import { truncateUtf8, utf8ByteLength } from '../lib/textSafety';
import { pactPublicUrl } from '../lib/router';
import QrCode from './QrCode';
import MediaPicker from './MediaPicker';
import { uploadProjectMedia, mediaEnabled } from '../lib/media';
import { useLanguage } from '../lib/i18n/LanguageContext';

// ═══ Lien Explorer après chaque transaction — important pour la démo devant les juges ═══
function TxLink({ sig, label }: { sig: string; label: string }) {
  return (
    <a
      href={explorerTxUrl(sig)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block text-[11px] text-accent-neon underline underline-offset-2 hover:opacity-80"
    >
      {label} : {sig.slice(0, 8)}… ↗
    </a>
  );
}

// ═══ Wallet plateforme BuildPact — FIXE, non modifiable ═══
// Pour le changer : modifie cette constante + commit + redeploy.
const PLATFORM_WALLET = 'AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH';

interface Props {
  onSuccess: () => void;
  onClose?: () => void;
}

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="mb-6 flex items-center gap-1.5 sm:gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'active' : 'todo';
        return (
          <div key={label} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <div
                className={
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-8 sm:w-8 ' +
                  (state === 'done'
                    ? 'bg-accent-neon text-ink-900'
                    : state === 'active'
                      ? 'bg-accent-violet text-ink-900 shadow-[0_0_0_4px_rgba(153,69,255,0.18)]'
                      : 'bg-white/5 text-ink-400')
                }
              >
                {state === 'done' ? '✓' : n}
              </div>
              <span
                className={
                  'hidden text-xs font-medium sm:inline ' +
                  (state === 'todo' ? 'text-ink-400' : 'text-white')
                }
              >
                {label}
              </span>
            </div>
            {n < labels.length && (
              <div
                className={
                  'h-px flex-1 ' + (state === 'done' ? 'bg-accent-neon/50' : 'bg-white/10')
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface MemberDraft {
  wallet: string;
  roleIds: string[];   // multi-sélection — ids de ALL_ROLES (ex: dev ET designer à la fois)
  customRole: string;  // rôle libre additionnel, combiné avec roleIds
  role: string;        // label final combiné envoyé on-chain (≤ 24 octets, dérivé via combineRoleLabels)
  share: number;
  shareTouched: boolean; // true dès que l'utilisateur édite le % à la main
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

const STAGE_IDS = ['dev', 'invest', 'both'] as const;

// Rôles Web3 / Web2, groupés par catégorie — source unique : ../lib/roles
// (partagée avec AddMemberModal, pour ne jamais désynchroniser les deux formulaires)

const inputCls =
  'w-full rounded-xl border border-white/10 bg-canvas-800/80 p-3 text-sm text-white ' +
  'transition-colors placeholder:text-ink-400 focus:border-accent-violet/60 focus:outline-none focus:ring-2 focus:ring-accent-violet/20';
const labelCls = 'block text-sm font-semibold text-white';
const hintCls = 'mt-1.5 block text-[11px] leading-snug text-ink-400';

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

// Suggère une part (%) pour UN membre selon le(s) rôle(s) cumulé(s) — un membre peut
// porter plusieurs casquettes (ex: Lead Dev + UX/UI), sa part suggérée grimpe en conséquence.
// Investisseur seul (weight 0) = pas de suggestion auto, part liée au montant négocié.
function suggestMemberShare(roleIds: string[]): number {
  if (roleIds.length === 0) return 10;
  const weights = roleIds.map((id) => ALL_ROLES.find((r) => r.id === id)?.weight ?? 10);
  if (weights.every((w) => w === 0)) return 0; // uniquement investisseur
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.min(Math.max(total, 5), 35);
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

export function CreatePactWizard({ onSuccess, onClose }: Props) {
  const { t } = useLanguage();
  const STAGES = [
    { id: 'dev', label: t('createWizard.stageDev') },
    { id: 'invest', label: t('createWizard.stageInvest') },
    { id: 'both', label: t('createWizard.stageBoth') },
  ] as const;
  const STEP_LABELS = [t('createWizard.stepProject'), t('createWizard.stepMembers'), t('createWizard.stepFinalize')];
  const { publicKey } = useWallet();
  const program = useAnchorProgram();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ajout de membres = 1 transaction (donc 1 signature wallet) PAR membre — pas
  // de batch on-chain. On affiche une progression claire pendant la boucle pour
  // que l'utilisateur sache combien de fois Phantom va lui redemander de signer.
  const [addMemberProgress, setAddMemberProgress] = useState<{ done: number; total: number } | null>(null);

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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);

  const [projectPda, setProjectPda] = useState<PublicKey | null>(null);
  const [projectId, setProjectId] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // ═══ Signatures des transactions — affichées avec lien Explorer ═══
  const [createSig, setCreateSig] = useState<string | null>(null);
  const [memberSigs, setMemberSigs] = useState<{ wallet: string; sig: string }[]>([]);

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
    // Compat brouillons anciens (avant multi-rôles) : roleId string isolé → roleIds[].
    setMembers(
      pendingDraft.members.map((m) => {
        const legacy = m as MemberDraft & { roleId?: string };
        const roleIds = Array.isArray(legacy.roleIds)
          ? legacy.roleIds
          : legacy.roleId && legacy.roleId !== 'custom'
          ? [legacy.roleId]
          : [];
        return { ...m, roleIds };
      })
    );
    setProjectId(pendingDraft.projectId);
    if (pendingDraft.projectPda) {
      try { setProjectPda(new PublicKey(pendingDraft.projectPda)); } catch {}
    }
    setPendingDraft(null);
  };

  if (!publicKey || !program) {
    return (
      <div className="glass-panel w-full p-8">
        <p className="text-ink-300">{t('createWizard.connectWalletFirst')}</p>
      </div>
    );
  }

  // Lien public de partage (fiche lecture seule #/pact/:pda) — sert aux membres pour
  // approuver depuis leur propre wallet sans passer par le wizard du créateur.
  const shareUrl = projectPda ? pactPublicUrl(projectPda.toBase58()) : '';
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* non bloquant — l'utilisateur peut toujours sélectionner le texte à la main */
    }
  };
  const handleNativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({ title: title || 'BuildPact', url: shareUrl });
    } catch {
      /* annulation utilisateur ou API indisponible — non bloquant */
    }
  };

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

  // ⚠️ Bug trouvé lors de l'audit du 24/08 : la description on-chain packée
  // ([stage] pitch | Rôles créateur : ... | 💰 Seed founder : ...) est
  // tronquée SILENCIEUSEMENT à 280 octets par truncateUtf8() dans
  // handleCreate() — si le total dépasse, la fin (souvent la liste de rôles
  // ou le seed) est coupée AU MILIEU D'UN MOT (ex: "UX/UI" → "UX/U"), et
  // comme le programme n'a AUCUNE instruction update_description, c'est
  // gravé on-chain de façon définitive. On avertit ici AVANT la création
  // pour que le fondateur raccourcisse pitch/rôles/seed lui-même.
  const previewStageLabel = stage ? STAGE_CANONICAL[stage as Exclude<PactStage, null>] : '';
  const previewSeedInfo =
    seedAmount && Number(seedAmount) > 0
      ? ` | 💰 Seed founder : ${seedAmount} SOL (engagement annoncé)`
      : '';
  const previewFullDescription =
    '[' + previewStageLabel + '] ' +
    description +
    ' | Rôles créateur : ' + myRoleLabel +
    previewSeedInfo;
  const descBytesUsed = utf8ByteLength(previewFullDescription);
  const descWillTruncate = descBytesUsed > 280;

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
      // ⚠️ i18n : le bracket on-chain utilise TOUJOURS la clé canonique fixe
      // (STAGE_CANONICAL), jamais le libellé traduit affiché sur le bouton —
      // sinon un pact créé en anglais ne matcherait plus STAGE_MAP côté
      // parsing (pitch.ts) et perdrait son badge de stage sur la Marketplace.
      const stageLabel = stage ? STAGE_CANONICAL[stage as Exclude<PactStage, null>] : stage;
      const id = slugId(title); // ✅ ≤ 20 bytes garanti

      const seedInfo =
        seedAmount && Number(seedAmount) > 0
          ? ` | 💰 Seed founder : ${seedAmount} SOL (engagement annoncé)`
          : '';
      const fullDescription = truncateUtf8(
        '[' + stageLabel + '] ' +
        description +
        ' | Rôles créateur : ' + myRoleLabel + // ✅ la liste COMPLÈTE part ici (280 octets max)
        seedInfo,
        280 // MAX_DESC_LEN côté programme — voir textSafety.ts pour le pourquoi du bug 6005
      );

      // ✅ UN SEUL rôle, court, ≤ 24 bytes pour le programme
      const creatorRoleOnChain = selectedRoles.length > 0
        ? roleShortLabel(selectedRoles[0])
        : truncateUtf8(customRoles[0] ?? 'Founder', 24); // MAX_ROLE_LEN côté programme

      const creatorShareBps = effectiveShare * 100;

      const { tx, projectPda: pda } = await createProject(
        program,
        publicKey,
        id,
        truncateUtf8(title, 40),      // MAX_TITLE_LEN côté programme (octets UTF-8, pas caractères JS)
        fullDescription,
        creatorRoleOnChain,
        creatorShareBps,
        new PublicKey(PLATFORM_WALLET)
      );

      setProjectId(id);
      setProjectPda(pda);
      setCreateSig(tx);

      // Upload logo/bannière APRÈS la création : on a besoin du vrai PDA
      // on-chain comme clé (project_media.project_pda). Non bloquant — si
      // l'upload échoue, le projet existe déjà on-chain, on prévient juste
      // que l'image n'est pas passée (l'utilisateur pourra réessayer plus
      // tard via "Modifier les médias" sur la carte du pact).
      const mediaFailures: string[] = [];
      if (logoFile) {
        const r = await uploadProjectMedia(pda.toBase58(), logoFile, 'logo');
        if ('error' in r) mediaFailures.push(`Logo : ${r.error}`);
      }
      if (bannerFile) {
        const r = await uploadProjectMedia(pda.toBase58(), bannerFile, 'banner');
        if ('error' in r) mediaFailures.push(`Bannière : ${r.error}`);
      }
      if (mediaFailures.length > 0) {
        setMediaWarning(
          mediaFailures.join(' — ') + ' (le projet est bien créé — réessaie depuis "Modifier les médias" sur sa carte)'
        );
      }

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
    const validMembers = members.filter((m) => m.wallet.trim() !== '');
    setAddMemberProgress({ done: 0, total: validMembers.length });
    try {
      const sigs: { wallet: string; sig: string }[] = [];
      let done = 0;
      for (const m of validMembers) {
        const sig = await addMember(
          program,
          publicKey,
          projectPda,
          new PublicKey(m.wallet),
          truncateUtf8(m.role, 24),   // MAX_ROLE_LEN — même bug 6005 si emoji/accents non tronqués en octets
          m.share * 100
        );
        sigs.push({ wallet: m.wallet, sig });
        done += 1;
        setAddMemberProgress({ done, total: validMembers.length });
      }
      setMemberSigs(sigs);
      setStep(3);
    } catch (e) {
      setError(parseTxError(e));
    } finally {
      setLoading(false);
      setAddMemberProgress(null);
    }
  };

  const updateMemberWallet = (index: number, value: string) => {
    const next = [...members];
    next[index] = { ...next[index], wallet: value };
    setMembers(next);
  };

  // Bascule un rôle dans la sélection multiple du membre (ajoute/retire).
  const toggleMemberRole = (index: number, roleId: string) => {
    const next = [...members];
    const m = { ...next[index] };
    m.roleIds = m.roleIds.includes(roleId)
      ? m.roleIds.filter((r) => r !== roleId)
      : [...m.roleIds, roleId];
    m.role = combineRoleLabels(m.roleIds, m.customRole);
    if (!m.shareTouched) m.share = suggestMemberShare(m.roleIds);
    next[index] = m;
    setMembers(next);
  };

  const updateMemberCustomRole = (index: number, text: string) => {
    const next = [...members];
    const m = { ...next[index], customRole: text };
    m.role = combineRoleLabels(m.roleIds, text);
    next[index] = m;
    setMembers(next);
  };

  const updateMemberShare = (index: number, value: number) => {
    const next = [...members];
    next[index] = { ...next[index], share: value, shareTouched: true };
    setMembers(next);
  };

  const resetMemberShareSuggestion = (index: number) => {
    const next = [...members];
    const m = next[index];
    next[index] = { ...m, share: suggestMemberShare(m.roleIds), shareTouched: false };
    setMembers(next);
  };

  // Calcule ce qu'il manque pour tomber pile sur 100%, en gardant les autres membres fixes
  const missingForRow = (index: number): number => {
    const othersSum = members.reduce(
      (acc, m, idx) => (idx === index ? acc : acc + (m.share || 0)),
      0
    );
    return Math.max(0, Math.round(remainingForMembers - othersSum));
  };

  const completeToHundred = (index: number) => {
    const next = [...members];
    next[index] = { ...next[index], share: missingForRow(index), shareTouched: true };
    setMembers(next);
  };

  return (
    <div className="glass-panel w-full p-6 sm:p-9">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-accent-neon">
            {t('createWizard.eyebrow')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('createWizard.title')}
          </h2>
          <p className="mt-1.5 text-sm text-ink-300">
            {step === 1 && t('createWizard.step1Sub')}
            {step === 2 && t('createWizard.step2Sub')}
            {step === 3 && t('createWizard.step3Sub')}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('createWizard.close')}
            className="shrink-0 rounded-lg border border-white/10 p-2 text-ink-400 transition hover:border-white/20 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      <Stepper step={step} labels={STEP_LABELS} />

      {/* ═══ Reprise de brouillon (page fermée = rien perdu) ═══ */}
      {pendingDraft && step === 1 && (
        <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3">
          <p className="text-[12px] font-semibold text-amber-300">
            {t('createWizard.draftFound', { title: pendingDraft.title })}
            {pendingDraft.projectPda && t('createWizard.draftOnChainNote')}
          </p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            {t('createWizard.draftHint')}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={resumeDraft}
              className="flex-1 rounded bg-amber-500 py-1.5 text-xs font-bold text-ink-900"
            >
              {t('createWizard.resumeDraft')}
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded border border-amber-400/40 px-3 py-1.5 text-xs text-amber-300"
            >
              {t('createWizard.ignoreDraft')}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ÉTAPE 1 — IDENTITÉ ═══════════ */}
      {step === 1 && (
        <div className="space-y-5">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
        <div className="space-y-5">

          {/* NOM */}
          <div>
            <label htmlFor="pact-title" className={labelCls}>{t('createWizard.projectName')}</label>
            <input
              id="pact-title"
              className={inputCls}
              placeholder={t('createWizard.projectNamePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <small className={hintCls}>
              {t('createWizard.projectNameHint')}
            </small>
          </div>

          {/* LOGO & BANNIÈRE — optionnel, améliore la visibilité pour attirer
              dons/investisseurs. Upload réel après création (voir handleCreate),
              stockage Supabase off-chain, aucune donnée mock si non renseigné. */}
          {mediaEnabled && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
              <MediaPicker
                kind="logo"
                label={t('createWizard.logoLabel')}
                hint={t('createWizard.logoHint')}
                onChange={setLogoFile}
              />
              <MediaPicker
                kind="banner"
                label={t('createWizard.bannerLabel')}
                hint={t('createWizard.bannerHint')}
                onChange={setBannerFile}
              />
            </div>
          )}

          {/* DESCRIPTION */}
          <div>
            <label htmlFor="pact-description" className={labelCls}>{t('createWizard.descriptionLabel')}</label>
            <textarea
              id="pact-description"
              className={inputCls}
              rows={3}
              placeholder={t('createWizard.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <small className={hintCls}>
              {t('createWizard.descriptionHint')}
            </small>
          </div>

          {/* TYPE DE RECHERCHE */}
          <div>
            <span id="pact-stage-label" className={labelCls}>{t('createWizard.stageLabel')}</span>
            <small className={hintCls}>
              {t('createWizard.stageHint')}
            </small>
            <div role="group" aria-labelledby="pact-stage-label" className="mt-1 flex gap-2">
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
            <label htmlFor="pact-seed-amount" className={labelCls}>{t('createWizard.seedLabel')}</label>
            <div className="flex items-center gap-2">
              <input
                id="pact-seed-amount"
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
              {t('createWizard.seedHint')}
            </small>
          </div>

        </div>
        <div className="space-y-5">

          {/* TES RÔLES (multi-sélection, groupés) */}
          <div>
            <span id="pact-roles-label" className={labelCls}>{t('createWizard.rolesLabel')}</span>
            <small className={hintCls}>
              {t('createWizard.rolesHint')}
            </small>

            {ROLE_GROUPS.map((group) => (
              <div key={group.category} className="mt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {group.category}
                </p>
                <div role="group" aria-labelledby="pact-roles-label" className="flex flex-wrap gap-2">
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
                placeholder={t('createWizard.customRolePlaceholder')}
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole(); } }}
              />
              <button
                type="button"
                onClick={addCustomRole}
                className="whitespace-nowrap rounded border border-accent-violet/40 bg-violet-500/10 px-3 text-xs text-accent-violet hover:bg-violet-500/20"
              >
                {t('createWizard.addRole')}
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
                {t('createWizard.selectAtLeastOneRole')}
              </small>
            )}
          </div>

          {/* TA PART — avec suggestion */}
          <div>
            <label htmlFor="pact-my-share" className={labelCls}>{t('createWizard.myShareLabel')}</label>
            <div className="flex items-center gap-2">
              <input
                id="pact-my-share"
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
                {t('createWizard.suggested', { n: suggested })}
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-[11px] leading-snug text-ink-300">
              💡 <strong className="text-white">{t('createWizard.suggestedNote', { n: suggested })}</strong>
              {t('createWizard.suggestedBody', { count: selectedRoles.length + customRoles.length })}
              <br />
              {t('createWizard.remainingNote', { n: remainingForMembers })}
            </div>

            {isGreedy && (
              <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] leading-snug text-amber-300">
                ⚠️ <strong>{t('createWizard.greedyWarning', { n: effectiveShare })}</strong>{' '}
                {t('createWizard.greedyBody', { cap, target: stage === 'invest' ? t('createWizard.investors') : t('createWizard.devs'), suggested })}
              </div>
            )}

            <div className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-[11px] leading-snug text-emerald-300">
              🧮 <strong>{t('createWizard.simulationLabel')}</strong>{' '}
              {t('createWizard.simulationBody', { amount: (effectiveShare / 10).toFixed(2) })}
            </div>
          </div>

          {/* WALLET PROTOCOLE — FIXE */}
          <div>
            <p className={labelCls}>{t('createWizard.platformWalletLabel')}</p>
            <div className="flex items-center gap-2 rounded border border-white/10 bg-canvas-900/60 p-2">
              <span className="flex-1 truncate font-mono text-[11px] text-ink-400">
                {PLATFORM_WALLET}
              </span>
              <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-ink-400">
                {t('createWizard.platformWalletFixed')}
              </span>
            </div>
            <small className={hintCls}>
              {t('createWizard.platformWalletHint')}
            </small>
          </div>

        </div>
        </div>

          {descWillTruncate && (
            <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-[11px] leading-snug text-red-300">
              ⚠️ <strong>{t('createWizard.descTruncateWarning', { used: descBytesUsed })}</strong>{' '}
              {t('createWizard.descTruncateBody')}
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !title || (selectedRoles.length === 0 && customRoles.length === 0)}
            className="w-full rounded-xl bg-accent-neon py-3.5 text-sm font-bold text-ink-900 transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t('createWizard.creating') : t('createWizard.createButton')}
          </button>
        </div>
      )}

      {/* ═══════════ ÉTAPE 2 — MEMBRES ═══════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-green-400">{t('createWizard.projectCreated', { id: projectId })}</p>
          {createSig && <TxLink sig={createSig} label={t('createWizard.creationTxLabel')} />}
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-left text-[11px] leading-relaxed text-emerald-200">
            {t('createWizard.canCloseNow')}
          </div>
          {mediaWarning && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-left text-[11px] text-amber-200">
              ⚠️ {mediaWarning}
            </div>
          )}
          <p className="text-xs text-ink-400">
            {t('createWizard.addMembersHint')}
          </p>

          <div className="rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-[11px] text-ink-300">
            💡 {t('createWizard.myShareReminder', { n: effectiveShare })}
            {t('createWizard.remainingForMembers', { n: remainingForMembers })}
            <br />
            {t('createWizard.minMembersWarning')}
          </div>

          {members.map((m, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-white/5 p-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border border-white/10 bg-canvas-800 p-2 text-sm text-white"
                  placeholder={t('createWizard.memberWalletPlaceholder')}
                  value={m.wallet}
                  onChange={(e) => updateMemberWallet(i, e.target.value)}
                />
                <input
                  type="number"
                  className="w-16 rounded border border-white/10 bg-canvas-800 p-2 text-sm text-white"
                  placeholder="%"
                  value={m.share}
                  onChange={(e) => updateMemberShare(i, Number(e.target.value))}
                />
              </div>

              {/* Rôles du membre — multi-sélection, un membre peut cumuler plusieurs casquettes */}
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {t('createWizard.memberRolesLabel')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleMemberRole(i, r.id)}
                      className={
                        'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ' +
                        (m.roleIds.includes(r.id)
                          ? 'border-accent-violet/60 bg-violet-500/20 text-white'
                          : 'border-white/10 text-ink-300 hover:text-white')
                      }
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                className="w-full rounded border border-white/10 bg-canvas-800 p-2 text-sm text-white"
                placeholder={t('createWizard.memberCustomRolePlaceholder')}
                value={m.customRole}
                onChange={(e) => updateMemberCustomRole(i, e.target.value)}
              />

              {m.roleIds.length === 0 && !m.customRole.trim() && (
                <small className="block text-[11px] text-red-400">
                  {t('createWizard.memberRoleRequired')}
                </small>
              )}

              <div className="flex flex-wrap items-center gap-x-3">
                {m.roleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resetMemberShareSuggestion(i)}
                    className="text-[10px] text-accent-violet hover:underline"
                  >
                    {t('createWizard.memberSuggested', { n: suggestMemberShare(m.roleIds) })}
                    {m.roleIds.length === 1 && m.roleIds[0] === 'investor'
                      ? t('createWizard.memberInvestorNote')
                      : ''}
                  </button>
                )}
                {totalShares !== 100 && missingForRow(i) > 0 && (
                  <button
                    type="button"
                    onClick={() => completeToHundred(i)}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    {t('createWizard.completeToHundred', { n: missingForRow(i) })}
                  </button>
                )}
              </div>

              <small className={hintCls}>
                {t('createWizard.memberHint')}
              </small>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setMembers([...members, { wallet: '', roleIds: [], customRole: '', role: '', share: 0, shareTouched: false }])}
            className="text-sm text-accent-violet hover:underline"
          >
            {t('createWizard.addMember')}
          </button>

          {members.length === 0 && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-[11px] text-red-300">
              {t('createWizard.noMemberError')}
            </div>
          )}

          {members.length >= 8 && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-[11px] text-amber-300">
              {t('createWizard.tooManyMembers')}
            </div>
          )}

          <p
            className={
              'text-sm font-bold ' +
              (totalShares === 100 ? 'text-green-400' : 'text-amber-400')
            }
          >
            {t('createWizard.totalShares', { n: totalShares })}{' '}
            {totalShares === 100
              ? t('createWizard.totalOk')
              : totalShares < 100
                ? t('createWizard.totalMissing', { n: Math.abs(100 - totalShares) })
                : t('createWizard.totalExtra', { n: Math.abs(100 - totalShares) })}
          </p>

          {/* Chaque membre = 1 instruction on-chain séparée = 1 signature Phantom.
              Pas de batch possible avec le programme actuel — on le dit clairement
              AVANT de cliquer, pour ne pas surprendre avec N popups de suite. */}
          {(() => {
            const walletCount = members.filter((m) => m.wallet.trim()).length;
            return walletCount > 0 ? (
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                {t('createWizard.signaturesWarning', { n: walletCount })}
              </div>
            ) : null;
          })()}

          {addMemberProgress && (
            <div className="rounded-lg border border-accent-violet/30 bg-violet-500/10 p-3 text-center text-[11px] text-ink-200">
              {t('createWizard.signatureProgress', { done: addMemberProgress.done + 1, total: addMemberProgress.total })}
              {addMemberProgress.done > 0 && t('createWizard.signatureProgressDone', { n: addMemberProgress.done })}
            </div>
          )}

          <button
            type="button"
            onClick={handleAddMember}
            disabled={
              loading ||
              totalShares !== 100 ||
              members.filter((m) => m.wallet.trim()).length === 0 ||
              members.some((m) => m.wallet.trim() && m.roleIds.length === 0 && !m.customRole.trim())
            }
            className="w-full rounded-xl bg-accent-violet py-3.5 text-sm font-bold text-ink-900 transition hover:bg-accent-violet/90 disabled:opacity-50"
          >
            {addMemberProgress
              ? t('createWizard.signatureButton', { done: addMemberProgress.done + 1, total: addMemberProgress.total })
              : t('createWizard.addMembersButton')}
          </button>
        </div>
      )}

      {/* ═══════════ ÉTAPE 3 — FINALISATION ═══════════ */}
      {step === 3 && (
        <div className="space-y-4 text-center">
          <p className="text-white">{t('createWizard.membersRegistered')}</p>

          {memberSigs.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-canvas-900/60 p-3 text-left">
              <p className="mb-1 text-[11px] font-semibold text-ink-300">
                {t('createWizard.addMemberTxLabel')}
              </p>
              {memberSigs.map((m) => (
                <TxLink key={m.sig} sig={m.sig} label={`${m.wallet.slice(0, 4)}…${m.wallet.slice(-4)}`} />
              ))}
            </div>
          )}

          <p className="text-sm text-ink-300">
            {t('createWizard.nextStepsIntro')}
          </p>
          <div className="rounded-lg border border-accent-violet/25 bg-violet-500/10 p-3 text-left text-[11px] leading-snug text-ink-300">
            <strong className="text-white">{t('createWizard.nextActionsHeading')}</strong>
            <br />{t('createWizard.nextAction1')}
            <br />{t('createWizard.nextAction2')}
            <br />{t('createWizard.nextAction3')}
          </div>

          {/* Lien de partage direct — la fiche publique #/pact/:pda, lecture seule,
              où chaque membre approuve avec SON wallet sans toucher au wizard créateur. */}
          {shareUrl && (
            <div className="glass-panel flex flex-col gap-3 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 text-left">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-ink-400">
                  {t('createWizard.shareLinkLabel')}
                </p>
                <p className="truncate rounded border border-white/10 bg-canvas-900/60 px-2 py-1.5 font-mono text-[11px] text-ink-300">
                  {shareUrl}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 hover:border-accent-violet/40 hover:text-white"
                  >
                    {linkCopied ? t('common.linkCopied') : t('common.copyLink')}
                  </button>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 hover:border-accent-violet/40 hover:text-white"
                    >
                      {t('createWizard.shareButton')}
                    </button>
                  )}
                </div>
              </div>
              <div className="mx-auto shrink-0 rounded-xl bg-white p-2 sm:mx-0">
                <QrCode value={shareUrl} size={88} />
              </div>
            </div>
          )}

          {/* ⚠️ Pas de bouton "Finaliser" ici : juste après add_member, TOUS les
              nouveaux membres ont approved=false (seul le créateur est
              auto-approuvé à la création). finalize() exige 100% d'approbations
              (NotAllApproved côté programme) — donc essayer maintenant échoue à
              coup sûr et redemande une signature pour rien. Le vrai bouton
              Finaliser vit sur la page Pacts (PactCard), qui suit en live les
              approbations on-chain et ne s'active QUE quand tout le monde a dit
              oui — inutile de dupliquer cette logique ici. */}
          <div className="rounded-lg border border-white/10 bg-canvas-900/40 p-3 text-left text-[11px] leading-snug text-ink-300">
            {t('createWizard.finalizeNote')}
          </div>
          <button
            type="button"
            onClick={() => { clearDraft(); onSuccess(); }}
            className="w-full rounded-xl border border-white/10 py-3.5 text-sm font-medium text-ink-200 transition hover:border-accent-violet/40 hover:text-white"
          >
            {t('createWizard.closeAndReturn')}
          </button>
        </div>
      )}

       {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
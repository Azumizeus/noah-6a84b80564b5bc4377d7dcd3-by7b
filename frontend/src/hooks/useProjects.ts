// src/hooks/useProjects.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { BN, type Program } from '@coral-xyz/anchor';
import {
  getProgram, getProvider, getReadonlyProgram, findVaultPda,
  fetchAllProjects, fetchProject, distribute, fund, finalize,
} from '../lib/anchor';
import { parseTxError, type ChainPact } from '../lib/pacts';
import { logPactEvent } from '../lib/activity';
import { useLanguage } from '../lib/i18n/LanguageContext';

/** Program Anchor : wallet réel si connecté, readonly sinon */
export function useAnchorProgram(): Program {
  const { publicKey, signTransaction, signAllTransactions, sendTransaction } = useWallet();
  return useMemo(() => {
    if (publicKey && signTransaction && signAllTransactions) {
      // On propage aussi sendTransaction : sur mobile (Seed Vault/MWA), c'est la
      // méthode native sign-and-send du wallet-adapter — bien plus fiable que
      // signTransaction() + envoi manuel, qui provoquait des échecs de signature
      // ("Missing signature for public key") sur Seeker. Voir buildAndSend().
      return getProgram(getProvider({ publicKey, signTransaction, signAllTransactions, sendTransaction }));
    }
    return getReadonlyProgram();
  }, [publicKey, signTransaction, signAllTransactions, sendTransaction]);
}

/** Pacts de test technique à ne jamais montrer publiquement (voir audit UI/UX #3) */
const HIDDEN_PACT_PDAS = new Set([
  '2n32pfWXDbYLLzy9ky3vj6xH4PFM2S7EXAGqsF83aLqc', // Nexus Markdown Ünïcode (test)
  'FBHXCus7YeeXNC9ZuRnhePvkyW798wetc3dA4x5Zg2Zc', // Café (test)
]);

/** Charge TOUS les projets on-chain + balances des vaults (1 seul appel RPC batch) */
export function useProjects() {
  const program = useAnchorProgram();
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [pacts, setPacts] = useState<ChainPact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const raw = await fetchAllProjects(program);
        const vaultPdas = raw.map((r: any) => findVaultPda(r.publicKey as PublicKey)[0]);
        const vaultInfos = await connection.getMultipleAccountsInfo(vaultPdas);

        const mapped: ChainPact[] = raw.map((r: any, i: number) => {
          const p = r.account;
          const vaultSol = (vaultInfos[i]?.lamports ?? 0) / LAMPORTS_PER_SOL;
          const me = publicKey
            ? p.members.find((m: any) => (m.wallet as PublicKey).equals(publicKey))
            : undefined;
          const myShareBps: number = me ? me.shareBps : 0;
          const finalized = 'finalized' in p.status;

          return {
            pda: r.publicKey as PublicKey,
            projectId: p.projectId as string,
            title: p.title as string,
            description: p.description as string,
            creator: p.creator as PublicKey,
            members: (p.members as any[]).map((m) => ({
              wallet: m.wallet as PublicKey,
              role: m.role as string,
              shareBps: m.shareBps as number,
              approved: m.approved as boolean,
            })),
            status: finalized ? 'active' : 'pending',
            protocolWallet: p.protocolWallet as PublicKey,
            vaultBalanceSol: vaultSol,
            myShareBps,
            myClaimableSol: (vaultSol * myShareBps) / 10_000,
          };
        });

        if (!cancelled) setPacts(mapped.filter(p => !HIDDEN_PACT_PDAS.has(p.pda.toString())));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [program, connection, publicKey, nonce]);

  return { pacts, loading, error, refresh };
}

// ═══════════════════════════════════════════════════════════════════
// Page publique #/pact/:pda — DOIT fonctionner sans wallet connecté.
// Réutilise getReadonlyProgram() (déjà utilisé par useProjects() quand
// aucun wallet n'est branché) pour charger UN SEUL projet par son PDA.
// ═══════════════════════════════════════════════════════════════════

export function usePublicPact(pdaBase58: string | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [pact, setPact] = useState<ChainPact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!pdaBase58) {
      setPact(null);
      setLoading(false);
      setError('Adresse de pact invalide.');
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pda = new PublicKey(pdaBase58 as string);
        const program = getReadonlyProgram();
        const p: any = await fetchProject(program, pda);
        const [vaultPda] = findVaultPda(pda);
        const vaultInfo = await connection.getAccountInfo(vaultPda);
        const vaultSol = (vaultInfo?.lamports ?? 0) / LAMPORTS_PER_SOL;
        const me = publicKey
          ? (p.members as any[]).find((m: any) => (m.wallet as PublicKey).equals(publicKey))
          : undefined;
        const myShareBps: number = me ? me.shareBps : 0;
        const finalized = 'finalized' in p.status;

        const mapped: ChainPact = {
          pda,
          projectId: p.projectId as string,
          title: p.title as string,
          description: p.description as string,
          creator: p.creator as PublicKey,
          members: (p.members as any[]).map((m) => ({
            wallet: m.wallet as PublicKey,
            role: m.role as string,
            shareBps: m.shareBps as number,
            approved: m.approved as boolean,
          })),
          status: finalized ? 'active' : 'pending',
          protocolWallet: p.protocolWallet as PublicKey,
          vaultBalanceSol: vaultSol,
          myShareBps,
          myClaimableSol: (vaultSol * myShareBps) / 10_000,
        };

        if (!cancelled) setPact(mapped);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [pdaBase58, connection, publicKey]);

  return { pact, loading, error };
}

export interface TxState {
  kind: 'success' | 'error';
  text: string;
  sig?: string;
}

/** Actions on-chain partagées par Dashboard et Pacts */
export function usePactActions(refresh: () => void) {
  const program = useAnchorProgram();
  const { publicKey } = useWallet();
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'distribute' | 'fund' | 'finalize' | null>(null);
  const [txState, setTxState] = useState<TxState | null>(null);

  const runDistribute = useCallback(async (pact: ChainPact) => {
    if (!publicKey) return;
    setBusyId(pact.pda.toBase58());
    setBusyAction('distribute');
    setTxState(null);
    try {
      const sig = await distribute(
        program, publicKey, pact.pda, pact.protocolWallet,
        pact.members.map((m) => m.wallet),
      );
      setTxState({ kind: 'success', text: t('txMessages.distributeSuccess', { amount: pact.vaultBalanceSol.toFixed(4), n: pact.members.length }), sig });
      refresh();
    } catch (e) {
      setTxState({ kind: 'error', text: parseTxError(e) });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }, [program, publicKey, refresh, t]);

  const runFund = useCallback(async (pact: ChainPact, amountSol: number) => {
    if (!publicKey) return;
    setBusyId(pact.pda.toBase58());
    setBusyAction('fund');
    setTxState(null);
    try {
      const lamports = new BN(Math.round(amountSol * LAMPORTS_PER_SOL));
      const sig = await fund(program, publicKey, pact.pda, lamports);
      setTxState({ kind: 'success', text: t('txMessages.fundSuccess', { amount: amountSol, title: pact.title }), sig });
      logPactEvent({ projectPda: pact.pda.toBase58(), kind: 'fund', actor: publicKey.toBase58(), amountSol, txSig: sig });
      refresh();
    } catch (e) {
      setTxState({ kind: 'error', text: parseTxError(e) });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }, [program, publicKey, refresh, t]);

  const runFinalize = useCallback(async (pact: ChainPact) => {
    if (!publicKey) return;

    // ═══ GARDE FRONT : seul le founder peut finaliser ═══
    if (!pact.creator.equals(publicKey)) {
      setTxState({
        kind: 'error',
        text: t('txMessages.onlyCreatorCanFinalize'),
      });
      return;
    }

    setBusyId(pact.pda.toBase58());
    setBusyAction('finalize');
    setTxState(null);
    try {
      const sig = await finalize(program, publicKey, pact.pda);
      setTxState({ kind: 'success', text: t('txMessages.finalizeSuccess', { title: pact.title }), sig });
      logPactEvent({ projectPda: pact.pda.toBase58(), kind: 'finalize', actor: publicKey.toBase58(), txSig: sig });
      refresh();
    } catch (e) {
      setTxState({ kind: 'error', text: parseTxError(e) });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }, [program, publicKey, refresh, t]);

  // Permet de fermer manuellement le bandeau du haut (bouton × dans TxBanner).
  // (voir aussi useTreasury() plus bas dans ce fichier)
  // Nécessaire aussi parce que Distribuer (géré en local dans PactCard, via
  // son propre reçu) ne passe jamais par ce hook — sans ce clear manuel, un
  // vieux message Fund/Finalize resterait affiché indéfiniment au-dessus
  // d'un reçu de distribution plus récent.
  const clearTxState = useCallback(() => setTxState(null), []);

  return { busyId, busyAction, txState, runDistribute, runFund, runFinalize, clearTxState };
}

// ═══════════════════════════════════════════════════════════════════
// TRÉSORERIE — données 100% réelles, aucune valeur inventée.
//  - TVL : solde live des vaults (1 appel RPC, exact)
//  - Flux récents : vraies transactions on-chain (getSignaturesForAddress
//    + getParsedTransaction), delta de solde du vault calculé directement
//    depuis preBalances/postBalances — pas de parsing fragile d'instruction
//  - Distribué : somme des flux négatifs (sorties de vault) trouvés dans
//    la fenêtre récupérée. Fenêtre bornée (dernières signatures par vault)
//    pour rester rapide — libellé honnête plutôt que "total historique"
//    non garanti.
// ═══════════════════════════════════════════════════════════════════

export interface TreasuryFlow {
  signature: string;
  label: string;
  projectTitle: string;
  amountSol: number; // signé : + = entrée dans le vault, − = sortie
  when: number | null; // unix seconds (blockTime), null si indisponible
}

export interface TreasurySummary {
  totalValueLockedSol: number;
  distributedRecentSol: number;
  pendingClaimsSol: number;
  flows: TreasuryFlow[];
  loading: boolean;
  error: string | null;
}

const SIGS_PER_VAULT = 15; // borne le nombre d'appels RPC — largement suffisant pour la démo
const MAX_FLOWS_SHOWN = 10;

function extractInstructionLabel(logMessages: string[] | null | undefined): string {
  if (!logMessages) return 'Transaction';
  for (const line of logMessages) {
    const m = line.match(/Instruction:\s*(\w+)/);
    if (m) return m[1];
  }
  return 'Transaction';
}

export function useTreasury(): TreasurySummary {
  const program = useAnchorProgram();
  const { connection } = useConnection();
  const { t } = useLanguage();
  const INSTRUCTION_LABELS: Record<string, string> = {
    Fund: t('txMessages.instrFund'),
    Distribute: t('txMessages.instrDistribute'),
    CreateProject: t('txMessages.instrCreateProject'),
    Finalize: t('txMessages.instrFinalize'),
    AddMember: t('txMessages.instrAddMember'),
    RemoveMember: t('txMessages.instrRemoveMember'),
    Approve: t('txMessages.instrApprove'),
    CloseProject: t('txMessages.instrCloseProject'),
  };
  const [state, setState] = useState<TreasurySummary>({
    totalValueLockedSol: 0,
    distributedRecentSol: 0,
    pendingClaimsSol: 0,
    flows: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const raw = await fetchAllProjects(program);
        const projects = raw as { publicKey: PublicKey; account: any }[];
        const vaultPdas = projects.map((r) => findVaultPda(r.publicKey)[0]);

        // ─── TVL réel : solde live de chaque vault ───
        const vaultInfos = await connection.getMultipleAccountsInfo(vaultPdas);
        const tvlLamports = vaultInfos.reduce((s, info) => s + (info?.lamports ?? 0), 0);
        const totalValueLockedSol = tvlLamports / LAMPORTS_PER_SOL;
        // 2% protocole prélevé à la distribution → 98% du TVL actuel est réclamable par les membres
        const pendingClaimsSol = totalValueLockedSol * 0.98;

        if (vaultPdas.length === 0) {
          if (!cancelled) {
            setState({ totalValueLockedSol: 0, distributedRecentSol: 0, pendingClaimsSol: 0, flows: [], loading: false, error: null });
          }
          return;
        }

        // ─── Signatures récentes par vault (bornées) ───
        const sigLists = await Promise.all(
          vaultPdas.map((pda) =>
            connection.getSignaturesForAddress(pda, { limit: SIGS_PER_VAULT }).catch(() => [])
          )
        );

        type SigEntry = { signature: string; blockTime: number | null; projectTitle: string };
        const entries: SigEntry[] = [];
        sigLists.forEach((list, i) => {
          const title = projects[i]?.account?.title ?? 'Projet';
          list.forEach((s) => entries.push({ signature: s.signature, blockTime: s.blockTime ?? null, projectTitle: title }));
        });

        // Dédup + tri par date décroissante + on garde large pour calculer "Distribué"
        const seen = new Set<string>();
        const deduped = entries.filter((e) => (seen.has(e.signature) ? false : (seen.add(e.signature), true)));
        deduped.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

        // ─── Détail des transactions : delta de solde du vault + label ───
        const parsed = await Promise.all(
          deduped.map(async (e) => {
            try {
              const tx = await connection.getParsedTransaction(e.signature, { maxSupportedTransactionVersion: 0 });
              if (!tx || !tx.meta) return null;
              const keys = tx.transaction.message.accountKeys.map((k: any) => k.pubkey.toBase58());
              // Retrouve l'index du vault concerné parmi les comptes de la tx
              const vaultIdx = keys.findIndex((k: string) => vaultPdas.some((v) => v.toBase58() === k));
              if (vaultIdx === -1) return null;
              const pre = tx.meta.preBalances[vaultIdx] ?? 0;
              const post = tx.meta.postBalances[vaultIdx] ?? 0;
              const deltaSol = (post - pre) / LAMPORTS_PER_SOL;
              if (deltaSol === 0) return null; // Approve/Finalize/AddMember : vault non touché, on ignore
              const rawLabel = extractInstructionLabel(tx.meta.logMessages);
              const flow: TreasuryFlow = {
                signature: e.signature,
                label: INSTRUCTION_LABELS[rawLabel] ?? rawLabel,
                projectTitle: e.projectTitle,
                amountSol: deltaSol,
                when: e.blockTime,
              };
              return flow;
            } catch {
              return null;
            }
          })
        );

        const flows = parsed.filter((f): f is TreasuryFlow => f !== null);
        const distributedRecentSol = flows
          .filter((f) => f.amountSol < 0)
          .reduce((s, f) => s + Math.abs(f.amountSol), 0);

        if (!cancelled) {
          setState({
            totalValueLockedSol,
            distributedRecentSol,
            pendingClaimsSol,
            flows: flows.slice(0, MAX_FLOWS_SHOWN),
            loading: false,
            error: null,
          });
        }
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, connection, t]); // `t` inclus : re-traduit les labels de flux au changement de langue

  return state;
}
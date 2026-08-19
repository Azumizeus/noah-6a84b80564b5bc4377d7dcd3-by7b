// src/hooks/useProjects.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { BN, type Program } from '@coral-xyz/anchor';
import {
  getProgram, getReadonlyProgram, findVaultPda,
  fetchAllProjects, distribute, fund,
} from '../lib/anchor';
import { parseTxError, type ChainPact } from '../lib/pacts';

/** Program Anchor : wallet réel si connecté, readonly sinon */
export function useAnchorProgram(): Program {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  return useMemo(() => {
    if (publicKey && signTransaction && signAllTransactions) {
      return getProgram({ publicKey, signTransaction, signAllTransactions });
    }
    return getReadonlyProgram();
  }, [publicKey, signTransaction, signAllTransactions]);
}

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

        if (!cancelled) setPacts(mapped);
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

export interface TxState {
  kind: 'success' | 'error';
  text: string;
  sig?: string;
}

/** Actions on-chain partagées par Dashboard et Pacts */
export function usePactActions(refresh: () => void) {
  const program = useAnchorProgram();
  const { publicKey } = useWallet();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'distribute' | 'fund' | null>(null);
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
      setTxState({ kind: 'success', text: `Distribution de ${pact.vaultBalanceSol.toFixed(4)} SOL envoyée à ${pact.members.length} membre(s).`, sig });
      refresh();
    } catch (e) {
      setTxState({ kind: 'error', text: parseTxError(e) });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }, [program, publicKey, refresh]);

  const runFund = useCallback(async (pact: ChainPact, amountSol: number) => {
    if (!publicKey) return;
    setBusyId(pact.pda.toBase58());
    setBusyAction('fund');
    setTxState(null);
    try {
      const lamports = new BN(Math.round(amountSol * LAMPORTS_PER_SOL));
      const sig = await fund(program, publicKey, pact.pda, lamports);
      setTxState({ kind: 'success', text: `${amountSol} SOL envoyés dans le vault de « ${pact.title} ».`, sig });
      refresh();
    } catch (e) {
      setTxState({ kind: 'error', text: parseTxError(e) });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }, [program, publicKey, refresh]);

  return { busyId, busyAction, txState, runDistribute, runFund };
}

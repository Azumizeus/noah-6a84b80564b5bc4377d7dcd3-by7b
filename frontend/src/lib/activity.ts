// src/lib/activity.ts
// ═══════════════════════════════════════════════════════════════════
// BuildPact — Fil d'activité par projet (table pact_events, Supabase)
// Chaque ligne écrite ici référence une tx déjà CONFIRMÉE on-chain
// (tx_sig) — cette table n'est qu'un journal d'affichage temps réel,
// jamais la source de vérité. Voir supabase/pact_events.sql.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled } from './supabaseClient';

export type PactEventKind = 'approve' | 'fund' | 'finalize' | 'distribute' | 'add_member';

export interface PactEvent {
  id: number;
  projectPda: string;
  kind: PactEventKind;
  actor: string;
  amountSol: number | null;
  txSig: string;
  createdAt: string; // ISO
}

function fromRemote(row: Record<string, unknown>): PactEvent {
  return {
    id: row.id as number,
    projectPda: row.project_pda as string,
    kind: row.kind as PactEventKind,
    actor: row.actor as string,
    amountSol: (row.amount_sol as number | null) ?? null,
    txSig: row.tx_sig as string,
    createdAt: row.created_at as string,
  };
}

/**
 * Enregistre un événement APRÈS confirmation on-chain d'une transaction.
 * Fire-and-forget : n'échoue jamais bruyamment (si Supabase n'est pas
 * configuré ou hors ligne, le fil d'activité est juste absent — la
 * transaction elle-même n'a jamais dépendu de cet appel).
 */
export function logPactEvent(event: {
  projectPda: string;
  kind: PactEventKind;
  actor: string;
  amountSol?: number | null;
  txSig: string;
}): void {
  if (!supabase) return;
  supabase
    .from('pact_events')
    .insert({
      project_pda: event.projectPda,
      kind: event.kind,
      actor: event.actor,
      amount_sol: event.amountSol ?? null,
      tx_sig: event.txSig,
    })
    .then(({ error }) => {
      if (error) console.warn('[activity] log error (non bloquant):', error.message);
    });
}

/** Charge les derniers événements d'un projet (fetch initial, avant le flux Realtime). */
export async function fetchRecentEvents(projectPda: string, limit = 20): Promise<PactEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('pact_events')
    .select('*')
    .eq('project_pda', projectPda)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[activity] fetch error:', error.message);
    return [];
  }
  return (data ?? []).map(fromRemote);
}

/**
 * Souscrit aux nouveaux événements Realtime pour un projet donné.
 * Retourne une fonction de désabonnement (à appeler dans le cleanup du useEffect).
 */
export function subscribeToPactEvents(
  projectPda: string,
  onEvent: (event: PactEvent) => void
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`pact_events:${projectPda}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pact_events', filter: `project_pda=eq.${projectPda}` },
      (payload) => onEvent(fromRemote(payload.new as Record<string, unknown>))
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

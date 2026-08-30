// src/lib/projectCreatedAt.ts
// ═══════════════════════════════════════════════════════════════════
// Date de création d'un pact, pour le tri "plus récent d'abord" du
// Marketplace. Le compte on-chain (ChainPact) n'a AUCUN champ date — le
// programme Anchor ne stocke pas de timestamp de création (voir
// CERVEAU_PROMPT.md, structure Project). Seule source disponible :
// `pact_events` (kind='create'), déjà utilisée ailleurs comme journal
// d'activité (chronique, XP) — même principe ici, un pact sans event
// 'create' enregistré (ne devrait pas arriver, mais robustesse) retombe
// simplement en fin de tri plutôt que de planter.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from './supabaseClient';

/** project_pda → timestamp ISO de création (premier event 'create' connu). */
export async function fetchProjectCreatedAtMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return map;
  const { data, error } = await supabase
    .from('pact_events')
    .select('project_pda, created_at')
    .eq('kind', 'create')
    .order('created_at', { ascending: true }); // le premier gagne en cas de doublon improbable
  if (error || !data) return map;
  for (const row of data) {
    const pda = row.project_pda as string;
    if (!map.has(pda)) map.set(pda, row.created_at as string);
  }
  return map;
}

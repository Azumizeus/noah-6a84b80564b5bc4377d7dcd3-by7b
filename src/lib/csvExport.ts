// src/lib/csvExport.ts
// ═══════════════════════════════════════════════════════════════════
// Export CSV de l'historique d'un wallet — fusion de deux sources déjà
// lisibles publiquement (voir RESUME_PROJET.md §5) :
//   - xp_events   : ledger XP append-only (RLS `xp_events_select_public`)
//   - pact_events : actions on-chain déjà vérifiées (chronique, via
//     fetchWalletChronicle) — mêmes lignes que l'onglet "Chronique" du
//     journal de quêtes, ici simplement exportées plutôt qu'affichées.
// Aucune écriture, aucun nouvel accès : uniquement des lectures déjà
// utilisées ailleurs dans l'app, réunies dans un seul fichier.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from './supabaseClient';
import { fetchWalletChronicle } from './gamification';

interface CsvRow {
  date: string; // ISO — trié dessus, format lisible laissé à l'ouverture tableur
  category: 'xp' | 'pact';
  detail: string; // source (xp) ou kind (pact_events)
  amountXp: number | '';
  amountSol: number | '';
  projectPda: string;
}

async function fetchXpRows(wallet: string): Promise<CsvRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('xp_events')
    .select('source, amount, project_pda, created_at')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) return [];
  return data.map((r) => ({
    date: r.created_at as string,
    category: 'xp' as const,
    detail: r.source as string,
    amountXp: Number(r.amount ?? 0),
    amountSol: '' as const,
    projectPda: (r.project_pda as string) ?? '',
  }));
}

async function fetchPactRows(wallet: string): Promise<CsvRow[]> {
  const chronicle = await fetchWalletChronicle(wallet, 2000);
  return chronicle.map((c) => ({
    date: c.createdAt,
    category: 'pact' as const,
    detail: c.kind,
    amountXp: '' as const,
    amountSol: c.amountSol ?? ('' as const),
    projectPda: c.projectPda,
  }));
}

function toCsv(rows: CsvRow[]): string {
  const header = ['date', 'categorie', 'detail', 'xp', 'sol', 'project_pda'];
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.date, r.category, r.detail, r.amountXp, r.amountSol, r.projectPda].map(escape).join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

/** Récupère XP + pacts d'un wallet, fusionne par date décroissante.
 *  Retourne `null` s'il n'y a rien à exporter (pour distinguer de la
 *  vraie erreur réseau — les deux se traduisent en UI par un message,
 *  mais pas le même). */
export async function buildWalletHistoryCsv(wallet: string): Promise<string | null> {
  const [xpRows, pactRows] = await Promise.all([fetchXpRows(wallet), fetchPactRows(wallet)]);
  const all = [...xpRows, ...pactRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (all.length === 0) return null;
  return toCsv(all);
}

/** Déclenche le téléchargement du CSV — standard `<a download>` généré en
 *  mémoire (blob), rien d'écrit sur disque côté serveur. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// src/lib/updates.ts
// ═══════════════════════════════════════════════════════════════════
// Fil d'avancement des membres (table project_updates, Supabase) — chaque
// membre du pact peut poster un court texte + un lien optionnel ("Milestone
// X fait", lien vers une démo/repo/capture). Off-chain, même modèle de
// confiance que pact_events/project_media (pas de vérif serveur de
// signature wallet en MVP). Voir supabase/project_updates.sql.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled } from './supabaseClient';
import { translate, type Lang } from './i18n/translations';

export { isRemoteEnabled as updatesEnabled };

function currentLang(): Lang {
  try {
    const stored = localStorage.getItem('buildpact_lang');
    if (stored === 'fr' || stored === 'en') return stored;
  } catch {
    /* non bloquant */
  }
  return 'fr';
}
function tr(key: string, params?: Record<string, string | number>): string {
  return translate(currentLang(), key, params);
}

const MAX_BODY_LEN = 500;
const MAX_LINK_LEN = 300;

export interface ProjectUpdate {
  id: number;
  projectPda: string;
  authorWallet: string;
  body: string;
  link: string | null;
  createdAt: string; // ISO
}

function fromRemote(row: Record<string, unknown>): ProjectUpdate {
  return {
    id: row.id as number,
    projectPda: row.project_pda as string,
    authorWallet: row.author_wallet as string,
    body: row.body as string,
    link: (row.link as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Validation avant envoi — évite un aller-retour réseau pour un texte vide/trop long. */
export function validateUpdateBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return tr('errors.updateEmptyBody');
  if (trimmed.length > MAX_BODY_LEN) return tr('errors.textTooLong', { max: MAX_BODY_LEN });
  return null;
}

export function validateUpdateLink(link: string): string | null {
  if (!link.trim()) return null; // optionnel
  if (link.trim().length > MAX_LINK_LEN) return tr('errors.linkTooLong', { max: MAX_LINK_LEN });
  try {
    new URL(link.trim());
    return null;
  } catch {
    return tr('errors.linkInvalid');
  }
}

export async function postProjectUpdate(params: {
  projectPda: string;
  authorWallet: string;
  body: string;
  link?: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: tr('errors.notConfigured') };

  const bodyErr = validateUpdateBody(params.body);
  if (bodyErr) return { error: bodyErr };
  const linkErr = validateUpdateLink(params.link ?? '');
  if (linkErr) return { error: linkErr };

  const { error } = await supabase.from('project_updates').insert({
    project_pda: params.projectPda,
    author_wallet: params.authorWallet,
    body: params.body.trim(),
    link: params.link?.trim() || null,
  });

  if (error) {
    console.warn('[updates] insert error:', error.message);
    return { error: tr('errors.sendFailed') };
  }
  return { ok: true };
}

/** Charge les mises à jour d'un projet, les plus récentes d'abord. */
export async function fetchProjectUpdates(projectPda: string, limit = 50): Promise<ProjectUpdate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('project_updates')
    .select('*')
    .eq('project_pda', projectPda)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[updates] fetch error:', error.message);
    return [];
  }
  return (data ?? []).map(fromRemote);
}

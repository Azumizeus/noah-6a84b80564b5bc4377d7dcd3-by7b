// src/lib/chat.ts
// ═══════════════════════════════════════════════════════════════════
// Chat simple par projet (table project_chat_messages, Supabase Realtime).
// Modèle de confiance MVP volontaire — même famille que pact_events /
// project_updates : écriture publique, pas de vérification serveur de
// signature. Voir supabase/project_chat.sql pour le détail du compromis.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isRemoteEnabled } from './supabaseClient';
import { translate, type Lang } from './i18n/translations';

export { isRemoteEnabled as chatEnabled };

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

export interface ChatMessage {
  id: number;
  projectPda: string;
  authorWallet: string;
  body: string;
  createdAt: string; // ISO
}

function fromRemote(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as number,
    projectPda: row.project_pda as string,
    authorWallet: row.author_wallet as string,
    body: row.body as string,
    createdAt: row.created_at as string,
  };
}

export function validateChatBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null; // vide = pas d'envoi, pas une erreur affichable
  if (trimmed.length > MAX_BODY_LEN) return tr('errors.messageTooLong', { max: MAX_BODY_LEN });
  return null;
}

export async function postChatMessage(params: {
  projectPda: string;
  authorWallet: string;
  body: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: tr('errors.notConfigured') };
  const trimmed = params.body.trim();
  if (!trimmed) return { error: tr('errors.chatEmptyBody') };
  if (trimmed.length > MAX_BODY_LEN) return { error: tr('errors.messageTooLong', { max: MAX_BODY_LEN }) };

  const { error } = await supabase.from('project_chat_messages').insert({
    project_pda: params.projectPda,
    author_wallet: params.authorWallet,
    body: trimmed,
  });
  if (error) {
    console.warn('[chat] insert error:', error.message);
    return { error: tr('errors.sendFailed') };
  }
  return { ok: true };
}

/** Charge les messages existants d'un projet, du plus ancien au plus récent. */
export async function fetchChatMessages(projectPda: string, limit = 100): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('project_chat_messages')
    .select('*')
    .eq('project_pda', projectPda)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.warn('[chat] fetch error:', error.message);
    return [];
  }
  return (data ?? []).map(fromRemote);
}

/** Timestamp (ISO) du dernier message d'un projet, ou null — pour un badge "nouveau message"
 *  sans charger tout l'historique. Lecture publique, comme fetchChatMessages(). */
export async function fetchLatestChatTimestamp(projectPda: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('project_chat_messages')
    .select('created_at')
    .eq('project_pda', projectPda)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.created_at as string;
}

/**
 * Supprime un message — founder-only, gate côté client dans ChatBox (même
 * modèle de confiance que le reste : pas de vérification serveur de
 * signature, la policy RLS DELETE est ouverte comme SELECT/INSERT).
 */
export async function deleteChatMessage(id: number): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: tr('errors.notConfigured') };
  const { error } = await supabase.from('project_chat_messages').delete().eq('id', id);
  if (error) {
    console.warn('[chat] delete error:', error.message);
    return { error: 'Erreur lors de la suppression du message.' };
  }
  return { ok: true };
}

/** Souscrit aux nouveaux messages Realtime d'un projet. Retourne une fonction de désabonnement. */
export function subscribeToChatMessages(
  projectPda: string,
  onMessage: (m: ChatMessage) => void
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`project_chat:${projectPda}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'project_chat_messages', filter: `project_pda=eq.${projectPda}` },
      (payload) => onMessage(fromRemote(payload.new as Record<string, unknown>))
    )
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}
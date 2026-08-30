// src/lib/assistant.ts
// ═══════════════════════════════════════════════════════════════════
// Nexus — assistant Solana/Web3 embarqué. Module VOLONTAIREMENT autonome
// (voir supabase/functions/assistant-chat/index.ts pour le pourquoi) :
// ce fichier + AssistantChat.tsx peuvent être retirés sans toucher au
// reste de l'app — aucun autre fichier n'importe quoi que ce soit d'ici.
//
// ── BYOK (Bring Your Own Key) ──────────────────────────────────────
// La clé API saisie par l'utilisateur ne quitte JAMAIS ce navigateur sauf
// pour être transmise, À CHAQUE APPEL, à assistant-chat (qui la relaie et
// ne la persiste jamais — voir son en-tête). Stockage local UNIQUEMENT,
// jamais dans Supabase, jamais dans le profil synchronisé. Pas de scope
// par wallet : une clé API est un secret d'appareil, pas une préférence
// d'identité à synchroniser entre appareils (contrairement au thème).
// ═══════════════════════════════════════════════════════════════════
import { isRemoteEnabled, SUPABASE_PROJECT_URL } from './supabaseClient';

/** Activation du module — désactivé par défaut : un déploiement qui n'a
 *  pas encore décidé/documenté ce module ne doit pas le faire apparaître
 *  tout seul. Mettre VITE_ASSISTANT_ENABLED=true dans .env.local pour
 *  l'activer. C'est le sens de "branchable/débranchable" : un flag de
 *  build, pas une case cachée dans le code à commenter/décommenter. */
export const ASSISTANT_ENABLED = String(import.meta.env.VITE_ASSISTANT_ENABLED ?? '').toLowerCase() === 'true';

export type AssistantProvider = 'anthropic' | 'openai';

export interface AssistantConfig {
  provider: AssistantProvider;
  apiKey: string;
  model: string;
  /** Uniquement pour 'openai' — endpoint compatible (Groq, DeepSeek,
   *  OpenRouter, un LLM local...). Vide = api.openai.com. */
  baseUrl?: string;
}

/** Juste des suggestions pré-remplies dans le formulaire — l'utilisateur
 *  peut taper n'importe quel identifiant de modèle que SA clé autorise.
 *  Volontairement pas figé en dur comme "la seule valeur possible" : les
 *  identifiants de modèles évoluent plus vite que ce fichier. */
export const MODEL_PLACEHOLDER: Record<AssistantProvider, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o-mini',
};

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CONFIG_KEY = 'buildpact_assistant_config';

export function loadAssistantConfig(): AssistantConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (parsed.provider === 'anthropic' || parsed.provider === 'openai') &&
      typeof parsed.apiKey === 'string' &&
      typeof parsed.model === 'string'
    ) {
      return parsed as AssistantConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAssistantConfig(config: AssistantConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* stockage plein/refusé — non bloquant, comme les autres préférences locales */
  }
}

/** "Oublier ma clé" — un utilisateur qui teste sur un poste partagé doit
 *  pouvoir effacer sa clé d'un clic, pas fouiller les devtools. */
export function clearAssistantConfig(): void {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* non bloquant */
  }
}

const ASSISTANT_CHAT_URL = SUPABASE_PROJECT_URL ? `${SUPABASE_PROJECT_URL}/functions/v1/assistant-chat` : '';

export type AssistantSendResult = { ok: true; reply: string } | { ok: false; error: string };

/** Envoie l'historique complet (assistant-chat est sans état, il ne garde
 *  aucun contexte entre deux appels) et renvoie la réponse du fournisseur
 *  choisi. Ne lève jamais — toute erreur réseau/fournisseur revient comme
 *  { ok: false, error }, à afficher tel quel dans le fil de discussion. */
export async function sendAssistantMessage(
  config: AssistantConfig,
  messages: AssistantMessage[]
): Promise<AssistantSendResult> {
  if (!isRemoteEnabled || !ASSISTANT_CHAT_URL) {
    return { ok: false, error: 'Service indisponible.' };
  }
  try {
    const res = await fetch(ASSISTANT_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        messages,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? `Erreur (${res.status}).` };
    }
    return { ok: true, reply: String(data.reply ?? '') };
  } catch {
    return { ok: false, error: 'Connexion impossible — vérifie ta connexion et réessaie.' };
  }
}

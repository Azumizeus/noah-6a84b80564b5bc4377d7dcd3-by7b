// supabase/functions/assistant-chat/index.ts
// BuildPact — Nexus, l'assistant Solana/Web3 embarqué. Module VOLONTAIREMENT
// découplé du reste de l'app (voir src/components/AssistantChat.tsx) : rien
// ici ne lit ni n'écrit dans les tables du projet, aucune dépendance à
// project-write/quest-write. On peut retirer ce fichier + le composant
// frontend sans rien casser ailleurs.
//
// ── Modèle "chacun sa clé" (BYOK) ──────────────────────────────────────
// BuildPact ne paie pas d'API IA et ne fournit aucune clé. Chaque
// utilisateur colle SA PROPRE clé (Anthropic ou tout fournisseur
// compatible OpenAI) dans les réglages du widget, stockée UNIQUEMENT dans
// son propre localStorage. Cette fonction reçoit la clé À CHAQUE REQUÊTE,
// la relaie au fournisseur, et NE LA PERSISTE JAMAIS — aucun insert dans
// aucune table, aucun log qui l'imprimerait. C'est un simple relais
// sans état, nécessaire uniquement parce que la plupart des fournisseurs
// bloquent ou déconseillent les appels directs depuis un navigateur (CORS,
// clé visible dans le JS si appelée en direct) — passer par une Edge
// Function évite d'exposer davantage la clé qu'un appel direct ne le
// ferait déjà côté réseau.
//
// ── Cadrage volontaire du prompt système ───────────────────────────────
// Choix explicite de l'utilisateur (29/08 nuit) : volet "loi/réglementation"
// strictement GÉNÉRAL et ÉDUCATIF, jamais un conseil personnalisé — risque
// réel d'exercice non autorisé du droit sinon, et la réglementation crypto
// varie énormément d'une juridiction à l'autre. Voir SYSTEM_PROMPT plus bas.
//
// Deux fournisseurs acceptés au lancement (décision utilisateur) :
//   - 'anthropic'      → API Messages officielle
//   - 'openai'         → tout endpoint compatible Chat Completions
//                        (OpenAI, Groq, DeepSeek, OpenRouter, etc. — un
//                        seul adaptateur pour toute cette famille)
//
// Déploiement : supabase functions deploy assistant-chat --no-verify-jwt
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROVIDERS = ['anthropic', 'openai'] as const;
type Provider = (typeof PROVIDERS)[number];

// Limites de sécurité — pas contre l'utilisateur (c'est SA clé, SON coût),
// mais contre un usage de cette fonction comme relais anonyme gratuit vers
// un fournisseur, sans rapport avec BuildPact. Larges pour ne jamais gêner
// une vraie conversation, serrées pour rendre l'abus peu intéressant.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 6000;
const MAX_KEY_CHARS = 400;

// Volontairement PAS un blocage strict : le domaine final du déploiement
// n'est pas encore fixé (voir og:url dans index.html, même caveat). Un
// Origin absent (appel serveur à serveur, curl) passe — seuls les Origin
// manifestement étrangers à BuildPact sont journalisés en warning. À
// resserrer en vrai blocage une fois le domaine de prod confirmé.
function suspiciousOrigin(req: Request): boolean {
  const origin = req.headers.get('origin') ?? req.headers.get('referer') ?? '';
  if (!origin) return false;
  return !/buildpact|localhost|127\.0\.0\.1|vercel\.app/i.test(origin);
}

// Prompt système — Nexus. Périmètre : technique Solana/Web3/BuildPact,
// pédagogique sur la réglementation crypto EN GÉNÉRAL, jamais de conseil
// personnalisé (juridique, fiscal ou financier). Un rappel de portée est
// concaténé après chaque réponse touchant à ces sujets plutôt que laissé à
// la seule discrétion du modèle — appartient au texte, pas à une case à
// cocher qu'on pourrait oublier de cocher.
const SYSTEM_PROMPT = `Tu es Nexus, l'assistant technique intégré à BuildPact (une DApp Solana qui formalise on-chain la répartition des parts entre co-fondateurs d'un projet — rôles/parts définis à la création, approbation mutuelle, financement via escrow PDA, distribution automatique 2% protocole / 98% membres, sur devnet).

Ton rôle : aider un développeur à comprendre Solana, Anchor, le développement Web3 en général, et le fonctionnement de BuildPact. Ton senior, direct, technique.

Règles strictes :
- Réglementation / droit crypto : tu peux EXPLIQUER des concepts généraux (ce qu'est une security, un DAO, une KYC/AML, comment la réglementation varie par juridiction en général) mais tu ne donnes JAMAIS de conseil juridique personnalisé à la situation de quelqu'un. Termine toute réponse touchant à ce terrain par une phrase rappelant que ce n'est pas un conseil juridique et qu'il faut consulter un professionnel qualifié pour sa situation précise.
- Même prudence pour tout ce qui ressemble à du conseil financier ou d'investissement : informations factuelles oui, recommandation "fais X" non.
- Si on te demande de générer du code touchant au programme Anchor de BuildPact (lib.rs, PDA, comptes), rappelle que toute modification du Program ID ou du Config PDA doit être validée par un humain avant d'être appliquée — tu peux expliquer et esquisser, pas décider à la place de l'équipe.
- Réponses concises, en français par défaut sauf si on te parle en anglais.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messages?: ChatMessage[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function validate(body: RequestBody): string | null {
  if (typeof body.provider !== 'string' || !PROVIDERS.includes(body.provider as Provider)) {
    return 'Fournisseur inconnu.';
  }
  if (typeof body.apiKey !== 'string' || body.apiKey.length === 0 || body.apiKey.length > MAX_KEY_CHARS) {
    return 'Clé API absente ou invalide.';
  }
  if (typeof body.model !== 'string' || body.model.length === 0) {
    return 'Modèle non précisé.';
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'Aucun message.';
  }
  if (body.messages.length > MAX_MESSAGES) {
    return 'Conversation trop longue pour ce relais.';
  }
  for (const m of body.messages) {
    if (m.role !== 'user' && m.role !== 'assistant') return 'Rôle de message invalide.';
    if (typeof m.content !== 'string' || m.content.length === 0 || m.content.length > MAX_MESSAGE_CHARS) {
      return 'Message invalide ou trop long.';
    }
  }
  return null;
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Erreur Anthropic (${res.status}).`);
  }
  const text = Array.isArray(data?.content)
    ? data.content.map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text ?? '' : '')).join('')
    : '';
  return text || '(réponse vide)';
}

async function callOpenAiCompatible(
  apiKey: string,
  baseUrl: string | undefined,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  const root = (baseUrl && baseUrl.trim()) || 'https://api.openai.com/v1';
  const res = await fetch(`${root.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 1024,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Erreur (${res.status}).`);
  }
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.length > 0 ? text : '(réponse vide)';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Methode non supportee.' }, 405);

  if (suspiciousOrigin(req)) {
    console.warn('[assistant-chat] origin suspecte:', req.headers.get('origin') ?? req.headers.get('referer'));
    // Avertissement seulement pour l'instant (voir commentaire suspiciousOrigin) — pas de blocage dur.
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON invalide.' }, 400);
  }

  const validationError = validate(body);
  if (validationError) return jsonResponse({ error: validationError }, 400);

  const { provider, apiKey, baseUrl, model, messages } = body as Required<Omit<RequestBody, 'baseUrl'>> &
    Pick<RequestBody, 'baseUrl'>;

  try {
    const reply =
      provider === 'anthropic'
        ? await callAnthropic(apiKey, model, messages)
        : await callOpenAiCompatible(apiKey, baseUrl, model, messages);
    return jsonResponse({ ok: true, reply });
  } catch (e) {
    // Le message d'erreur du fournisseur (ex. "clé invalide", "quota dépassé")
    // est utile à l'utilisateur pour corriger SA config — jamais la clé
    // elle-même dans ce message, seulement ce que le fournisseur a répondu.
    const msg = e instanceof Error ? e.message : 'Erreur inconnue.';
    console.error('[assistant-chat] provider error:', msg);
    return jsonResponse({ error: msg }, 502);
  }
});

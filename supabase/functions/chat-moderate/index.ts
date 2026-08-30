// supabase/functions/chat-moderate/index.ts
// ═══════════════════════════════════════════════════════════════════
// BuildPact — Écriture SÉCURISÉE du chat de projet (post + delete + revoke).
//
// Cette fonction est le SEUL chemin d'écriture vers project_chat_messages.
// La table n'a plus aucune policy INSERT ni DELETE : il ne reste que
// SELECT public (lecture + Realtime).
//
// ── Pourquoi ────────────────────────────────────────────────────────
// `author_wallet` était rempli par le client sous une policy
// `INSERT with check (true)`. N'importe qui pouvait donc poster sous le
// wallet d'un autre — y compris celui du founder. Aucune règle SQL ne
// peut corriger ça : Postgres n'a aucun moyen de savoir qui contrôle une
// clé Solana. Seule une signature ed25519 le prouve. `author_wallet` est
// donc renseigné par le SERVEUR à partir du wallet dont la signature
// vient d'être validée, jamais depuis un champ client.
//
// ── Trois régimes de preuve ─────────────────────────────────────────
// POST   → SESSION. Le wallet signe UNE fois un jeton de session valable
//          SESSION_TTL_HOURS, réutilisé pour tous ses messages sur ce
//          projet. Signer chaque message était sûr mais imposait un popup
//          par message, ce qui rend un chat inutilisable.
// DELETE → signature UNITAIRE, fraîche (5 min), liée à l'id du message.
//          La modération est rare et destructive : elle garde le régime
//          strict.
// REVOKE → signature UNITAIRE, fraîche. Invalide côté serveur toutes les
//          sessions du wallet (voir plus bas).
//
// ⚠️ Ce que la session coûte, et qui est assumé : c'est un jeton porteur
// (bearer). Il vit en localStorage côté client. Quiconque parvient à le
// lire (XSS, extension malveillante, poste partagé) peut publier sous ce
// wallet jusqu'à expiration. C'est le prix exact de la suppression du
// popup par message. La session est donc volontairement SCOPÉE À UN
// PROJET : un jeton fuité ne pollue que ce chat-là.
// Conséquence directe : contrairement à l'ancien schéma, la signature ne
// peut plus être liée au contenu (elle précède les messages qu'elle
// autorise). Le rate limit borne le dégât, la révocation permet d'y
// couper court.
//
// ── Révocation (table chat_session_revocations) ─────────────────────
// On stocke un CUTOFF par wallet — « toute session signée avant cet
// instant est refusée » — et non l'empreinte des jetons révoqués. Motif :
// celui qui révoque est sur un AUTRE appareil que celui compromis, il n'a
// donc pas le jeton à invalider sous la main. Un cutoff couvre les jetons
// qu'on ne connaît pas.
// Le cutoff utilise l'horloge du SERVEUR, jamais une date fournie par le
// client : un cutoff choisi par l'appelant permettrait une révocation
// no-op (date passée) ou un auto-blocage (date lointaine).
//
// ── Anti-rejeu inter-actions (load-bearing) ─────────────────────────
// Les messages signés sont validés par des regex ANCRÉES (^…$), pas par
// des `includes`. Sans ça, une signature de suppression — même format,
// mêmes lignes Wallet/Projet/Timestamp — pourrait être présentée comme
// un jeton de session et servir à poster. Les trois formats doivent
// rester mutuellement inacceptables.
//
// ── Décodage on-chain sans Anchor ───────────────────────────────────
// Le compte Project commence par [8 octets de discriminant][creator:
// pubkey 32 octets] — `creator` est le PREMIER champ de la struct.
// Le discriminant est vérifié avant lecture : ce n'est pas un offset
// deviné, un compte d'un autre type est rejeté.
// ⚠️ Si l'ordre des champs de `Project` change dans lib.rs, cette
// fonction casse silencieusement (mauvaise pubkey → tout est refusé).
//
// Déploiement : supabase functions deploy chat-moderate --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@5';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const B58 = '[1-9A-HJ-NP-Za-km-z]{32,44}';
const WALLET_RE = new RegExp(`^${B58}$`);

/** Fenêtre stricte des signatures unitaires (suppression, révocation). */
const UNIT_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;

/**
 * Durée de vie d'une session de chat.
 * ⚠️ Doit rester synchronisé avec CHAT_SESSION_TTL_HOURS dans
 * src/lib/chatSession.ts — la valeur est écrite EN TOUTES LETTRES dans le
 * message signé, donc changer ce nombre invalide instantanément toutes
 * les sessions en circulation (elles ne matchent plus la regex). C'est
 * la révocation globale du pauvre ; la révocation par wallet, elle, passe
 * désormais par chat_session_revocations.
 */
const SESSION_TTL_HOURS = 24;
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

/**
 * Tolérance appliquée au cutoff de révocation.
 *
 * Le cutoff est posé à l'heure du SERVEUR, mais le `Timestamp` d'une
 * session vient de l'horloge du CLIENT. Sans marge, un utilisateur dont la
 * pendule retarde re-signerait un jeton daté « avant » sa propre
 * révocation : rejeté, re-signé, rejeté — un popup en boucle sans issue.
 *
 * Le prix de cette marge est explicite : un jeton volé signé dans les
 * 60 s précédant la révocation y survit. On préfère cette fenêtre étroite
 * à un blocage définitif d'utilisateurs légitimes.
 */
const REVOCATION_SKEW_MS = MAX_CLOCK_SKEW_MS;

const MAX_BODY_LEN = 500;
// Anti-spam. Avec la session, une signature autorise N messages : le rate
// limit n'est plus un confort, c'est la borne de dégât en cas de jeton
// volé — la révocation permettant ensuite d'y couper court.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_MESSAGES = 10;

// Formats acceptés, ancrés de bout en bout.
const SESSION_RE = new RegExp(
  `^BuildPact — session chat\\nWallet: (${B58})\\nProjet: (${B58})\\nValidité: ${SESSION_TTL_HOURS} h\\nTimestamp: (\\d{10,16})$`
);
const DELETE_RE = new RegExp(
  `^BuildPact — suppression d'un message\\nWallet: (${B58})\\nProjet: (${B58})\\nMessage: (\\d+)\\nTimestamp: (\\d{10,16})$`
);
// Pas de ligne `Projet:` : la révocation est volontairement wallet-large.
const REVOKE_RE = new RegExp(
  `^BuildPact — révocation des sessions chat\\nWallet: (${B58})\\nTimestamp: (\\d{10,16})$`
);

// Discriminant Anchor du compte Project (cf. buildpact_idl.json).
const PROJECT_DISCRIMINATOR = [205, 168, 189, 202, 181, 247, 142, 19];

const RPC_URL = Deno.env.get('SOLANA_RPC_URL') ?? 'https://api.devnet.solana.com';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Vérifie une signature ed25519 détachée. */
function verifySignatureBytes(wallet: string, message: string, signature: unknown): boolean {
  if (!Array.isArray(signature) || signature.length !== 64) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      Uint8Array.from(signature as number[]),
      bs58.decode(wallet)
    );
  } catch {
    return false;
  }
}

function isFresh(timestamp: number, maxAgeMs: number): boolean {
  const age = Date.now() - timestamp;
  return age <= maxAgeMs && age >= -MAX_CLOCK_SKEW_MS;
}

/**
 * Lit `project.creator` on-chain. Retourne null si le compte n'existe pas
 * ou n'est pas un compte Project (discriminant différent).
 */
async function fetchProjectCreator(projectPda: string): Promise<string | null> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [projectPda, { encoding: 'base64', commitment: 'confirmed' }],
    }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);

  const json = await res.json();
  const b64 = json?.result?.value?.data?.[0];
  if (typeof b64 !== 'string') return null;

  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length < 40) return null;
  for (let i = 0; i < 8; i++) {
    if (raw[i] !== PROJECT_DISCRIMINATOR[i]) return null;
  }
  return bs58.encode(raw.slice(8, 40));
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Cutoff de révocation d'un wallet, en ms epoch. `null` = aucune
 * révocation enregistrée.
 *
 * Lève en cas d'erreur SQL : l'appelant DOIT échouer plutôt que de
 * poursuivre. Traiter une panne de lecture comme « pas de révocation »
 * ressusciterait silencieusement des jetons que l'utilisateur croit morts,
 * ce qui est précisément le scénario qu'on cherche à fermer.
 */
async function fetchRevocationCutoff(
  admin: ReturnType<typeof createClient>,
  wallet: string
): Promise<number | null> {
  const { data, error } = await admin
    .from('chat_session_revocations')
    .select('revoked_before')
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.revoked_before) return null;
  return new Date(data.revoked_before as string).getTime();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non supportée.' }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON invalide.' }, 400);
  }

  const {
    action,
    projectPda,
    messageId,
    body,
    sessionMessage,
    sessionSignature,
    message,
    signature,
  } = (payload ?? {}) as {
    action?: string;
    projectPda?: string;
    messageId?: number;
    body?: string;
    sessionMessage?: string;
    sessionSignature?: unknown;
    message?: string;
    signature?: unknown;
  };

  if (action !== 'post' && action !== 'delete' && action !== 'revoke') {
    return jsonResponse({ error: 'Action inconnue.' }, 400);
  }

  const admin = adminClient();
  if (!admin) return jsonResponse({ error: 'Configuration serveur manquante.' }, 500);

  // ══════════════════════════════════════════════════════════════════
  // REVOKE — invalider toutes les sessions du wallet, côté serveur
  // ══════════════════════════════════════════════════════════════════
  // Traité avant la validation de `projectPda` : la révocation ne cible
  // aucun projet en particulier.
  if (action === 'revoke') {
    if (typeof message !== 'string') {
      return jsonResponse({ error: 'Message de signature absent.' }, 400);
    }
    const parsedRevoke = REVOKE_RE.exec(message);
    if (!parsedRevoke) return jsonResponse({ error: 'Message de signature invalide.' }, 400);

    const [, revokeWallet, revokeTs] = parsedRevoke;

    // Fraîcheur + signature : sans ces deux contrôles, n'importe qui
    // pourrait révoquer les sessions d'un tiers (déni de service) ou
    // rejouer indéfiniment une ancienne demande de révocation.
    if (!isFresh(Number(revokeTs), UNIT_MAX_AGE_MS)) {
      return jsonResponse({ error: 'Signature expirée — réessaie.' }, 401);
    }
    if (!verifySignatureBytes(revokeWallet, message, signature)) {
      return jsonResponse(
        { error: 'Signature invalide — impossible de prouver que tu contrôles ce wallet.' },
        401
      );
    }

    // Horloge serveur, une seule ligne par wallet (upsert) : la table ne
    // grossit pas et une nouvelle révocation écrase simplement l'ancienne.
    const revokedBefore = new Date().toISOString();
    const { error: revokeError } = await admin
      .from('chat_session_revocations')
      .upsert(
        { wallet: revokeWallet, revoked_before: revokedBefore, updated_at: revokedBefore },
        { onConflict: 'wallet' }
      );

    if (revokeError) {
      console.error('[chat-moderate] revoke error:', revokeError.message);
      return jsonResponse({ error: `Échec de la révocation — ${revokeError.message}` }, 500);
    }
    return jsonResponse({ ok: true, revokedBefore });
  }

  if (typeof projectPda !== 'string' || !WALLET_RE.test(projectPda)) {
    return jsonResponse({ error: 'Projet invalide.' }, 400);
  }

  // ══════════════════════════════════════════════════════════════════
  // POST — publier un message, autorisé par un jeton de session
  // ══════════════════════════════════════════════════════════════════
  if (action === 'post') {
    if (typeof sessionMessage !== 'string') {
      return jsonResponse({ error: 'Session absente.', code: 'session_invalid' }, 401);
    }

    // Regex ancrée : c'est elle qui empêche qu'une signature émise pour
    // une autre action serve de jeton de session.
    const parsed = SESSION_RE.exec(sessionMessage);
    if (!parsed) {
      return jsonResponse({ error: 'Session invalide.', code: 'session_invalid' }, 401);
    }
    const [, sessionWallet, sessionProject, sessionTs] = parsed;

    // Le jeton ne vaut que pour le projet pour lequel il a été signé.
    if (sessionProject !== projectPda) {
      return jsonResponse(
        { error: 'Session émise pour un autre projet.', code: 'session_invalid' },
        401
      );
    }
    if (!isFresh(Number(sessionTs), SESSION_TTL_MS)) {
      // `code` permet au client d'effacer son cache et de refaire signer
      // l'utilisateur sans qu'il ait à comprendre ce qui s'est passé.
      return jsonResponse({ error: 'Session expirée.', code: 'session_expired' }, 401);
    }
    if (!verifySignatureBytes(sessionWallet, sessionMessage, sessionSignature)) {
      return jsonResponse(
        { error: 'Session invalide — signature non vérifiable.', code: 'session_invalid' },
        401
      );
    }

    // À partir d'ici, `sessionWallet` est prouvé. Aucun champ `wallet`
    // envoyé par le client n'est lu : l'auteur est celui de la session.
    const authorWallet = sessionWallet;

    // Révocation serveur : une signature valide et non expirée ne suffit
    // plus, le jeton doit aussi être postérieur au dernier cutoff posé par
    // ce wallet. C'est ce qui rend le bouton « Révoquer » réel au lieu de
    // simplement vider le localStorage de l'appareil courant.
    let cutoff: number | null;
    try {
      cutoff = await fetchRevocationCutoff(admin, authorWallet);
    } catch (e) {
      // Échec fermé, volontairement : cf. commentaire de fetchRevocationCutoff.
      console.error('[chat-moderate] revocation lookup failed:', (e as Error).message);
      return jsonResponse({ error: 'Vérification de session indisponible — réessaie.' }, 503);
    }
    if (cutoff !== null && Number(sessionTs) < cutoff - REVOCATION_SKEW_MS) {
      // `session_revoked` : le client efface son cache et refait signer.
      // Ce n'est pas un contournement — re-signer exige une approbation
      // explicite dans le wallet, que le voleur du jeton ne peut pas
      // produire.
      return jsonResponse(
        { error: 'Session révoquée — une nouvelle signature est requise.', code: 'session_revoked' },
        401
      );
    }

    if (typeof body !== 'string') return jsonResponse({ error: 'Message invalide.' }, 400);
    const trimmed = body.trim();
    if (!trimmed) return jsonResponse({ error: 'Message vide.' }, 400);
    if (trimmed.length > MAX_BODY_LEN) {
      return jsonResponse({ error: `Message trop long (max ${MAX_BODY_LEN} caractères).` }, 400);
    }

    // Le projet doit exister on-chain — évite d'accumuler des lignes
    // rattachées à des PDA inventés.
    let creator: string | null;
    try {
      creator = await fetchProjectCreator(projectPda);
    } catch {
      return jsonResponse({ error: 'RPC Solana injoignable — réessaie.' }, 503);
    }
    if (!creator) return jsonResponse({ error: 'Projet introuvable on-chain.' }, 404);

    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countError } = await admin
      .from('project_chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('author_wallet', authorWallet)
      .gte('created_at', since);

    if (!countError && (count ?? 0) >= RATE_LIMIT_MAX_MESSAGES) {
      return jsonResponse({ error: 'Trop de messages envoyés — attends une minute.' }, 429);
    }

    const { data, error } = await admin
      .from('project_chat_messages')
      .insert({ project_pda: projectPda, author_wallet: authorWallet, body: trimmed })
      .select('id, project_pda, author_wallet, body, created_at')
      .single();

    if (error) {
      console.error('[chat-moderate] insert error:', error.message);
      return jsonResponse({ error: `Échec de l'envoi — ${error.message}` }, 500);
    }
    return jsonResponse({ ok: true, message: data });
  }

  // ══════════════════════════════════════════════════════════════════
  // DELETE — modération founder-only, signature unitaire et fraîche
  // ══════════════════════════════════════════════════════════════════
  if (typeof message !== 'string') {
    return jsonResponse({ error: 'Message de signature absent.' }, 400);
  }
  const parsedDelete = DELETE_RE.exec(message);
  if (!parsedDelete) return jsonResponse({ error: 'Message de signature invalide.' }, 400);

  const [, delWallet, delProject, delMessageId, delTs] = parsedDelete;

  // La cible signée doit être exactement la cible demandée, sinon une
  // signature obtenue pour un couple (projet, message) serait rejouable
  // sur un autre.
  if (delProject !== projectPda || Number(delMessageId) !== messageId) {
    return jsonResponse({ error: 'Message de signature incohérent.' }, 400);
  }
  if (!Number.isInteger(messageId) || (messageId as number) <= 0) {
    return jsonResponse({ error: 'Message invalide.' }, 400);
  }
  if (!isFresh(Number(delTs), UNIT_MAX_AGE_MS)) {
    return jsonResponse({ error: 'Signature expirée — réessaie.' }, 401);
  }
  if (!verifySignatureBytes(delWallet, message, signature)) {
    return jsonResponse(
      { error: 'Signature invalide — impossible de prouver que tu contrôles ce wallet.' },
      401
    );
  }

  let creator: string | null;
  try {
    creator = await fetchProjectCreator(projectPda);
  } catch {
    return jsonResponse({ error: 'RPC Solana injoignable — réessaie.' }, 503);
  }
  if (!creator) return jsonResponse({ error: 'Projet introuvable on-chain.' }, 404);

  if (creator !== delWallet) {
    return jsonResponse({ error: 'Seul le founder du projet peut supprimer un message.' }, 403);
  }

  // Le `.eq('project_pda', projectPda)` est la garde essentielle : il
  // enferme la suppression dans le projet dont on vient de prouver que
  // l'appelant est founder.
  const { data, error } = await admin
    .from('project_chat_messages')
    .delete()
    .eq('id', messageId as number)
    .eq('project_pda', projectPda)
    .select('id');

  if (error) {
    console.error('[chat-moderate] delete error:', error.message);
    return jsonResponse({ error: `Échec de la suppression — ${error.message}` }, 500);
  }
  if (!data || data.length === 0) {
    // Message déjà supprimé, ou appartenant à un autre projet.
    return jsonResponse({ error: 'Message introuvable dans ce projet.' }, 404);
  }

  return jsonResponse({ ok: true });
});

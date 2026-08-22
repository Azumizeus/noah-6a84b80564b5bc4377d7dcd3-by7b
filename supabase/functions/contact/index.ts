// supabase/functions/contact/index.ts
// ═══════════════════════════════════════════════════════════════════
// BuildPact — Demandes de contact entre builders, SÉCURISÉES.
//
// v1 (voir historique git) laissait table + policies RLS ouvertes, comme
// project_media/chat — un choix MVP assumé mais avec 2 défauts réels :
// n'importe qui pouvait prétendre être n'importe quel wallet en envoyant
// une demande ("from_wallet" jamais vérifié), et n'importe qui pouvait lire
// les demandes adressées à n'importe qui d'autre (la RLS ne filtrait pas
// par destinataire). v2 : même schéma que le vault — table 100% fermée,
// cette fonction vérifie une signature signMessage AVANT d'utiliser la
// service_role key, pour les deux actions :
//   - 'send' : le wallet signe pour prouver qu'il est bien `from_wallet`
//   - 'list' : le wallet signe pour prouver qu'il est bien `to_wallet`
//              (donc en droit de lire CES demandes précises, les siennes)
//
// Déploiement : supabase functions deploy contact --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2';
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@5';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const MAX_ROLE_LEN = 60;
const MAX_MESSAGE_LEN = 500;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Vérifie signature ed25519 + anti-replay — même logique que vault/update-profile. */
function verifyWalletSignature(wallet: string, message: string, signature: unknown): string | null {
  if (typeof wallet !== 'string' || !WALLET_RE.test(wallet)) return 'Wallet invalide.';
  if (typeof message !== 'string' || !message.includes(wallet)) return 'Message de signature invalide.';
  if (!Array.isArray(signature) || signature.length !== 64) return 'Signature invalide.';

  const tsMatch = message.match(/Timestamp:\s*(\d+)/);
  if (!tsMatch) return 'Message de signature invalide (timestamp absent).';
  const age = Date.now() - Number(tsMatch[1]);
  if (age > MAX_MESSAGE_AGE_MS || age < -MAX_CLOCK_SKEW_MS) return 'Signature expirée — réessaie.';

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(signature as number[]);
    const pubkeyBytes = bs58.decode(wallet);
    if (!nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes)) {
      return 'Signature invalide — impossible de prouver que tu contrôles ce wallet.';
    }
  } catch {
    return 'Signature invalide.';
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non supportée.' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'JSON invalide.' }, 400);
  }

  const { action, wallet, message, signature } = body ?? {};

  const sigErr = verifyWalletSignature(wallet, message, signature);
  if (sigErr) return jsonResponse({ error: sigErr }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuration serveur manquante.' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ═══ send : `wallet` (prouvé) envoie une demande à `toWallet` ═══
  if (action === 'send') {
    const toWallet = String(body.toWallet ?? '');
    if (!WALLET_RE.test(toWallet)) return jsonResponse({ error: 'Destinataire invalide.' }, 400);
    if (toWallet === wallet) return jsonResponse({ error: 'Tu ne peux pas te contacter toi-même.' }, 400);

    const roleText = String(body.roleText ?? '').trim().slice(0, MAX_ROLE_LEN);
    const messageText = String(body.messageText ?? '').trim().slice(0, MAX_MESSAGE_LEN);
    if (!messageText) return jsonResponse({ error: "Écris un message avant d'envoyer." }, 400);

    const { error } = await admin.from('builder_contact_requests').insert({
      from_wallet: wallet,
      to_wallet: toWallet,
      role_text: roleText,
      message: messageText,
    });
    if (error) {
      console.error('[contact] insert error:', error.message);
      return jsonResponse({ error: "Échec de l'envoi — réessaie." }, 500);
    }
    return jsonResponse({ ok: true });
  }

  // ═══ rate : `wallet` (prouvé) note `toWallet` (1 à 6 étoiles, upsert —
  // une seconde notation du même couple met juste à jour la précédente) ═══
  if (action === 'rate') {
    const toWallet = String(body.toWallet ?? '');
    if (!WALLET_RE.test(toWallet)) return jsonResponse({ error: 'Destinataire invalide.' }, 400);
    if (toWallet === wallet) return jsonResponse({ error: 'Tu ne peux pas te noter toi-même.' }, 400);
    const stars = Number(body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 6) {
      return jsonResponse({ error: 'Note invalide (1 à 6 étoiles).' }, 400);
    }

    const { error } = await admin.from('builder_ratings').upsert(
      {
        from_wallet: wallet,
        to_wallet: toWallet,
        stars,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'from_wallet,to_wallet' }
    );
    if (error) {
      console.error('[contact] rate error:', error.message);
      return jsonResponse({ error: "Échec de l'envoi de la note — réessaie." }, 500);
    }
    return jsonResponse({ ok: true });
  }

  // ═══ list : `wallet` (prouvé) liste SES PROPRES demandes reçues ═══
  if (action === 'list') {
    const { data, error } = await admin
      .from('builder_contact_requests')
      .select('*')
      .eq('to_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[contact] list error:', error.message);
      return jsonResponse({ error: 'Échec du chargement.' }, 500);
    }
    return jsonResponse({
      requests: (data ?? []).map((r) => ({
        id: r.id,
        fromWallet: r.from_wallet,
        toWallet: r.to_wallet,
        roleText: r.role_text,
        message: r.message,
        createdAt: r.created_at,
      })),
    });
  }

  return jsonResponse({ error: 'Action inconnue.' }, 400);
});

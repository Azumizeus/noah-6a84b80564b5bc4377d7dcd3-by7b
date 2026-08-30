// supabase/functions/network-write/index.ts
// ═══════════════════════════════════════════════════════════════════
// BuildPact — Écriture SÉCURISÉE du Réseau Builders.
//
// Couvre les trois tables du feed transverse :
//   network_posts           → publications      (post / delete-post)
//   network_post_reactions  → encouragements    (react, bascule)
//   network_post_comments   → commentaires      (comment)
// + la délivrance d'URL d'upload signée pour les images de post.
//
// Ces trois tables sont en RLS lecture seule : `select ... using (true)`
// et AUCUNE policy insert/update/delete. Le navigateur ne peut donc rien
// y écrire directement, quelle que soit la clé anon qu'il détient. Toute
// écriture passe par ici, avec la service-role key qui contourne RLS —
// contournement légitime PARCE QUE la signature ed25519 est vérifiée
// juste avant.
//
// ── Pourquoi une signature et pas auth.uid() ───────────────────────
// Postgres n'a aucun moyen de savoir qui contrôle une clé Solana. Sans
// cette fonction, la seule alternative était `insert with check (true)`,
// c'est-à-dire : n'importe qui peut poster au nom de n'importe quel
// wallet, supprimer les posts des autres, et gonfler les compteurs
// d'encouragement en boucle. Ce n'est pas théorique — c'est une requête
// curl.
//
// ── Un seul format de message signé, et c'est voulu ────────────────
// project-write utilise UN format PAR action (update/apply/media) pour
// empêcher qu'une signature obtenue pour l'une serve à l'autre. Ici les
// quatre actions ont la même portée — « ce wallet agit sur le réseau,
// maintenant » — et aucune ne peut être détournée en une autre : le
// serveur revérifie systématiquement la propriété de la ressource
// (auteur du post pour delete-post, existence du post pour react et
// comment). Multiplier les formats aurait ajouté des popups sans fermer
// le moindre abus.
//
// ⚠️ Conséquence à connaître : une signature réseau valide pendant 5
// minutes autorise n'importe laquelle des quatre actions. C'est le prix
// du confort ; le rate-limit ci-dessous en borne l'exploitation.
//
// Déploiement : supabase functions deploy network-write --no-verify-jwt
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

// Fenêtre de validité de la signature. 5 min laisse le temps d'un popup
// wallet lent (mobile, hardware) sans transformer la signature en jeton
// permanent réutilisable.
const MAX_AGE_MS = 5 * 60 * 1000;
// Tolérance d'horloge : un client légèrement en avance produirait un
// timestamp futur. Sans cette marge, sa signature serait rejetée alors
// qu'elle est parfaitement légitime.
const MAX_CLOCK_SKEW_MS = 60 * 1000;

// Regex ANCRÉE (^…$). Non négociable : avec un `includes`, un attaquant
// pourrait faire signer un texte anodin contenant ce motif et le rejouer.
const NETWORK_RE = new RegExp(
  `^BuildPact — réseau builders\\nWallet: (${B58})\\nTimestamp: (\\d{10,16})$`
);

// ⚠️ Doivent rester ALIGNÉES sur src/lib/network.ts (MAX_POST_BODY /
// MAX_COMMENT_BODY). Un écart laisserait le client accepter un texte que
// le serveur tronque en silence — l'utilisateur verrait son post amputé
// sans comprendre pourquoi.
const MAX_POST_BODY = 500;
const MAX_COMMENT_BODY = 280;
const MAX_URL = 500;

// Bucket + bornes image — alignés sur src/lib/network.ts.
const MEDIA_BUCKET = 'network-media';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// ── Anti-spam ──────────────────────────────────────────────────────
// La signature prouve QUI écrit, pas COMBIEN de fois. Un wallet légitime
// peut donc inonder le feed. Ces plafonds sont volontairement larges :
// ils gênent un script, pas un humain.
const RATE_WINDOW_MS = 60 * 1000;
const MAX_POSTS_PER_WINDOW = 5;
const MAX_COMMENTS_PER_WINDOW = 20;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function verifySignatureBytes(wallet: string, message: string, signature: unknown): boolean {
  if (!Array.isArray(signature) || signature.length !== 64) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      Uint8Array.from(signature as number[]),
      bs58.decode(wallet)
    );
  } catch {
    // bs58.decode lève sur une adresse malformée. Un throw ici serait un
    // 500 alors que le cas normal est « signature invalide » → 401.
    return false;
  }
}

function isFresh(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  return age <= MAX_AGE_MS && age >= -MAX_CLOCK_SKEW_MS;
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Id de post : entier positif. Rejette `1.5`, `NaN`, `"3; drop"`. */
function parsePostId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function extFromMime(mimeType: string): string {
  const fromType = mimeType.split('/')[1];
  return fromType === 'jpeg' ? 'jpg' : fromType || 'png';
}

/** Compte les lignes récentes d'un wallet dans une table donnée. */
async function recentCount(
  admin: ReturnType<typeof createClient>,
  table: 'network_posts' | 'network_post_comments',
  wallet: string
): Promise<number> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('author_wallet', wallet)
    .gte('created_at', since);
  // En cas d'erreur on renvoie 0 : mieux vaut laisser passer un post de
  // trop que bloquer tout le feed sur une panne de comptage.
  if (error) return 0;
  return count ?? 0;
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

  const admin = adminClient();
  if (!admin) return jsonResponse({ error: 'Configuration serveur manquante.' }, 500);

  const action = payload.action;
  const message = payload.message;
  if (typeof message !== 'string') {
    return jsonResponse({ error: 'Message de signature absent.' }, 400);
  }

  // ══════════════════════════════════════════════════════════════════
  // GARDE COMMUNE — toutes les actions passent par ici, sans exception.
  //
  // `wallet` est extrait DU MESSAGE SIGNÉ, jamais du champ `wallet` du
  // payload. C'est le point central : le payload est contrôlé par
  // l'appelant, le message signé ne l'est pas. Faire confiance au champ
  // libre reviendrait à ne rien vérifier du tout.
  // ══════════════════════════════════════════════════════════════════
  const parsed = NETWORK_RE.exec(message);
  if (!parsed) return jsonResponse({ error: 'Message de signature invalide.' }, 400);
  const [, wallet, ts] = parsed;

  if (!isFresh(Number(ts))) {
    return jsonResponse({ error: 'Signature expirée — réessaie.' }, 401);
  }
  if (!verifySignatureBytes(wallet, message, payload.signature)) {
    return jsonResponse({ error: 'Signature invalide.' }, 401);
  }

  // ══════════════════════════════════════════════════════════════════
  // POST — publication
  // ══════════════════════════════════════════════════════════════════
  if (action === 'post') {
    const body = clean(payload.body, MAX_POST_BODY);
    if (!body) return jsonResponse({ error: 'Publication vide.' }, 400);

    const imageUrl = clean(payload.imageUrl, MAX_URL) || null;
    const linkedProjectPda = clean(payload.linkedProjectPda, 64) || null;
    if (linkedProjectPda && !WALLET_RE.test(linkedProjectPda)) {
      return jsonResponse({ error: 'Projet lié invalide.' }, 400);
    }

    if ((await recentCount(admin, 'network_posts', wallet)) >= MAX_POSTS_PER_WINDOW) {
      return jsonResponse({ error: 'Trop de publications — attends une minute.' }, 429);
    }

    const { data, error } = await admin
      .from('network_posts')
      .insert({
        author_wallet: wallet,
        body,
        image_url: imageUrl,
        linked_project_pda: linkedProjectPda,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[network-write] post insert:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ ok: true, id: data.id });
  }

  // ══════════════════════════════════════════════════════════════════
  // REACT — bascule l'encouragement 🤝
  //
  // La table n'a NI id NI type de réaction : sa clé est (post_id, wallet).
  // Une réaction est donc binaire, et « déjà présente → on supprime »
  // est la seule sémantique possible sans migration.
  // ══════════════════════════════════════════════════════════════════
  if (action === 'react') {
    const postId = parsePostId(payload.postId);
    if (postId === null) return jsonResponse({ error: 'Post invalide.' }, 400);

    // Vérifier l'existence du post avant d'insérer : sans FK, une
    // réaction sur un post supprimé créerait une ligne orpheline que rien
    // ne nettoierait jamais.
    const { data: post } = await admin
      .from('network_posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();
    if (!post) return jsonResponse({ error: 'Publication introuvable.' }, 404);

    const { data: existing } = await admin
      .from('network_post_reactions')
      .select('post_id')
      .eq('post_id', postId)
      .eq('wallet', wallet)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from('network_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('wallet', wallet);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, reacted: false });
    }

    const { error } = await admin
      .from('network_post_reactions')
      .insert({ post_id: postId, wallet });
    if (error) {
      // 23505 = doublon : deux clics simultanés. L'état voulu est atteint,
      // ce n'est pas une erreur pour l'appelant.
      if ((error as { code?: string }).code === '23505') {
        return jsonResponse({ ok: true, reacted: true });
      }
      console.error('[network-write] react insert:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ ok: true, reacted: true });
  }

  // ══════════════════════════════════════════════════════════════════
  // COMMENT — commentaire sur un post
  // ══════════════════════════════════════════════════════════════════
  if (action === 'comment') {
    const postId = parsePostId(payload.postId);
    if (postId === null) return jsonResponse({ error: 'Post invalide.' }, 400);

    const body = clean(payload.body, MAX_COMMENT_BODY);
    if (!body) return jsonResponse({ error: 'Commentaire vide.' }, 400);

    const { data: post } = await admin
      .from('network_posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();
    if (!post) return jsonResponse({ error: 'Publication introuvable.' }, 404);

    if ((await recentCount(admin, 'network_post_comments', wallet)) >= MAX_COMMENTS_PER_WINDOW) {
      return jsonResponse({ error: 'Trop de commentaires — attends une minute.' }, 429);
    }

    const { data, error } = await admin
      .from('network_post_comments')
      .insert({ post_id: postId, author_wallet: wallet, body })
      .select('id')
      .single();

    if (error) {
      console.error('[network-write] comment insert:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ ok: true, id: data.id });
  }

  // ══════════════════════════════════════════════════════════════════
  // DELETE-POST — suppression par son AUTEUR uniquement
  //
  // La vérification d'auteur se fait ici, pas en RLS : côté Postgres, la
  // service-role key ignore les policies. C'est donc CE bloc, et lui
  // seul, qui empêche de supprimer le post d'un autre.
  // ══════════════════════════════════════════════════════════════════
  if (action === 'delete-post') {
    const postId = parsePostId(payload.postId);
    if (postId === null) return jsonResponse({ error: 'Post invalide.' }, 400);

    const { data: post } = await admin
      .from('network_posts')
      .select('id, author_wallet')
      .eq('id', postId)
      .maybeSingle();
    if (!post) return jsonResponse({ error: 'Publication introuvable.' }, 404);
    if (post.author_wallet !== wallet) {
      return jsonResponse({ error: "Tu n'es pas l'auteur de cette publication." }, 403);
    }

    // Enfants d'abord. La migration pose des FK ON DELETE CASCADE, mais
    // ce nettoyage explicite reste : si la fonction tourne contre une base
    // où la migration n'a pas été appliquée, l'ordre inverse laisserait
    // des réactions et commentaires orphelins, comptés à jamais.
    await admin.from('network_post_reactions').delete().eq('post_id', postId);
    await admin.from('network_post_comments').delete().eq('post_id', postId);

    const { error } = await admin.from('network_posts').delete().eq('id', postId);
    if (error) {
      console.error('[network-write] delete post:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
    return jsonResponse({ ok: true });
  }

  // ══════════════════════════════════════════════════════════════════
  // POST-MEDIA-UPLOAD-URL — URL d'upload signée pour une image de post
  //
  // Le client n'écrit JAMAIS dans le bucket avec la clé anon : il reçoit
  // un jeton à usage unique lié à un chemin que LE SERVEUR calcule. Le
  // chemin est préfixé par le wallet signataire, donc personne ne peut
  // écraser le fichier d'un autre — même en rejouant l'appel.
  // ══════════════════════════════════════════════════════════════════
  if (action === 'post-media-upload-url') {
    const mimeType = clean(payload.mimeType, 100);
    const sizeBytes = Number(payload.sizeBytes);

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return jsonResponse({ error: 'Format non supporté.' }, 400);
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: 'Fichier trop volumineux.' }, 400);
    }

    const path = `${wallet}/${Date.now()}.${extFromMime(mimeType)}`;
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[network-write] signed upload url:', error?.message);
      return jsonResponse({ error: "Impossible de préparer l'upload." }, 500);
    }

    const { data: pub } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return jsonResponse({
      ok: true,
      path,
      token: data.token,
      publicUrl: pub.publicUrl,
    });
  }

  return jsonResponse({ error: 'Action inconnue.' }, 400);
});

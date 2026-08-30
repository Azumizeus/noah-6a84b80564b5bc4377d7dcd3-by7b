// src/lib/pythPrice.ts
// ═══════════════════════════════════════════════════════════════════
// Prix SOL/USD via l'API publique Hermes de Pyth Network — aucune clé
// requise. Utilisé UNIQUEMENT pour un affichage indicatif ("≈ $X") à
// côté des montants SOL : jamais lu par le programme Anchor, jamais
// utilisé dans un calcul de distribution/fund on-chain. Voir le
// disclaimer affiché avec le réglage (settings.usdHint).
//
// Feed id SOL/USD, identique sur tous les réseaux (le feed Pyth ne
// dépend pas de devnet/mainnet — c'est un prix de marché réel) :
// https://pyth.network/developers/price-feed-ids → Crypto.SOL/USD
// ═══════════════════════════════════════════════════════════════════
const SOL_USD_FEED_ID = 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56';
const HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_USD_FEED_ID}`;

// Cache mémoire partagé entre tous les composants — évite un fetch par
// carte affichée à l'écran (une page peut lister des dizaines de pacts).
let cachedPrice: number | null = null;
let cachedAt = 0;
let inFlight: Promise<number | null> | null = null;
const CACHE_TTL_MS = 30_000; // 30s — assez frais pour un affichage indicatif

interface HermesResponse {
  parsed?: Array<{
    price: { price: string; expo: number };
  }>;
}

async function fetchSolUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch(HERMES_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as HermesResponse;
    const p = data.parsed?.[0]?.price;
    if (!p) return null;
    // Pyth encode le prix en entier + exposant (ex. price=1234500, expo=-4
    // → 123.45). Voir doc Hermes : prix réel = price * 10^expo.
    return Number(p.price) * 10 ** p.expo;
  } catch {
    return null;
  }
}

/** Retourne le dernier prix SOL/USD connu, en (re)fetchant si le cache a
 *  plus de 30s. `null` = pas encore de valeur / indisponible (l'appelant
 *  doit afficher settings.usdUnavailable plutôt que planter). */
export async function getSolUsdPrice(): Promise<number | null> {
  const age = Date.now() - cachedAt;
  if (cachedPrice !== null && age < CACHE_TTL_MS) return cachedPrice;
  if (inFlight) return inFlight;
  inFlight = fetchSolUsdPrice().then((v) => {
    inFlight = null;
    if (v !== null) {
      cachedPrice = v;
      cachedAt = Date.now();
    }
    return v ?? cachedPrice; // conserve l'ancienne valeur plutôt que null sur un échec ponctuel
  });
  return inFlight;
}

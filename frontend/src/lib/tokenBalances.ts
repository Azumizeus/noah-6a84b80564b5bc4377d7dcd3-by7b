// src/lib/tokenBalances.ts
// ═══════════════════════════════════════════════════════════════════
// Soldes multi-tokens du wallet connecté (30/08) — demande utilisateur :
// voir SOL + les tokens SPL qu'il détient (USDC, USDT, SKR...) dans le
// menu du bouton wallet, pas seulement le solde SOL.
//
// Approche volontairement AGNOSTIQUE plutôt qu'une liste figée de mints
// à afficher : on lit TOUS les comptes de tokens SPL réellement détenus
// par le wallet (getParsedTokenAccountsByOwner), puis on n'attache un
// libellé/symbole connu QUE pour les mints qu'on peut identifier avec
// certitude (voir KNOWN_MINTS ci-dessous). Un token non reconnu s'affiche
// quand même, avec son mint tronqué — jamais caché, jamais mal étiqueté.
//
// Pourquoi cette approche plutôt que deviner des adresses :
//   - USDC devnet a un mint OFFICIEL stable, émis par Circle
//     (4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU, vérifié via
//     explorer.solana.com et la doc Circle) — on peut l'étiqueter en
//     confiance.
//   - USDT n'a PAS d'équivalent officiel documenté sur devnet (Tether ne
//     maintient pas de mint de test standard) — on ne fabrique pas
//     d'adresse : si le wallet détient un token qui se prétend "USDT"
//     via un faucet tiers, il s'affichera générique (mint tronqué), pas
//     mal étiqueté "USDT" à tort.
//   - SKR/SKG (tokens du projet) : mint pas encore déployé (voir
//     .env — VITE_SKR_TOKEN_MINT à renseigner le jour où le token
//     existe). Lu dynamiquement depuis l'env, pas codé en dur.
//   - ETH/BTC "pontés" (Wormhole) : pas de mint devnet officiel stable
//     identifiable avec confiance au moment d'écrire ceci — même
//     traitement, affichage générique si le wallet en détient.
//
// Le paiement AVEC ces tokens (financer un pact en USDC etc.) n'est PAS
// couvert ici — lecture seule. Voir la conversation avec l'utilisateur :
// ça demande de nouvelles instructions Anchor (vault en SPL Token, pas
// seulement en SOL natif), un chantier séparé qui touche au programme et
// nécessite un GO explicite avant modification (règle absolue du projet).
// ═══════════════════════════════════════════════════════════════════
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

export interface TokenBalance {
  mint: string;
  /** Symbole lisible si le mint est reconnu, sinon null (affichage générique). */
  symbol: string | null;
  uiAmount: number;
  decimals: number;
}

interface KnownMint {
  symbol: string;
}

// Mint → infos. Seulement des mints vérifiés (voir commentaire d'en-tête).
// Les tokens du projet (SKR/SKG) se rattachent dynamiquement via env, pas
// ici en dur, tant qu'ils ne sont pas officiellement déployés.
const KNOWN_MINTS: Record<string, KnownMint> = {
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { symbol: 'USDC' },
};

function projectTokenMints(): Record<string, KnownMint> {
  const out: Record<string, KnownMint> = {};
  const skr = (import.meta.env.VITE_SKR_TOKEN_MINT as string | undefined)?.trim();
  const skg = (import.meta.env.VITE_SKG_TOKEN_MINT as string | undefined)?.trim();
  if (skr) out[skr] = { symbol: 'SKR' };
  if (skg) out[skg] = { symbol: 'SKG' };
  return out;
}

/** Solde de tous les tokens SPL détenus par `owner` (montant > 0
 *  uniquement — un compte de token vide n'intéresse personne ici). */
export async function fetchTokenBalances(
  connection: Connection,
  owner: PublicKey
): Promise<TokenBalance[]> {
  const known = { ...KNOWN_MINTS, ...projectTokenMints() };
  const { value } = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const balances: TokenBalance[] = [];
  for (const { account } of value) {
    const info = account.data.parsed?.info;
    const amount = info?.tokenAmount;
    if (!info || !amount || amount.uiAmount === null || amount.uiAmount === 0) continue;
    const mint: string = info.mint;
    balances.push({
      mint,
      symbol: known[mint]?.symbol ?? null,
      uiAmount: amount.uiAmount,
      decimals: amount.decimals,
    });
  }

  // Connus d'abord (USDC/SKR/SKG avant les tokens non identifiés), puis
  // par solde décroissant à l'intérieur de chaque groupe.
  balances.sort((a, b) => {
    if (!!a.symbol !== !!b.symbol) return a.symbol ? -1 : 1;
    return b.uiAmount - a.uiAmount;
  });
  return balances;
}

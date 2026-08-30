// src/components/AppWalletButton.tsx
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import WalletButton from './WalletButton';
import { fetchTokenBalances, type TokenBalance } from '../lib/tokenBalances';

export function AppWalletButton() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  // Soldes SPL (USDC, SKR/SKG si déployés, autres tokens détenus) — voir
  // lib/tokenBalances.ts. Lecture seule, aucun lien avec le financement
  // des pacts (toujours en SOL natif côté programme).
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    let cancelled = false;
    connection.getBalance(publicKey)
      .then((l) => { if (!cancelled) setBalance(l / LAMPORTS_PER_SOL); })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [connection, publicKey]);

  useEffect(() => {
    if (!publicKey) { setTokenBalances([]); return; }
    let cancelled = false;
    fetchTokenBalances(connection, publicKey)
      .then((list) => { if (!cancelled) setTokenBalances(list); })
      .catch(() => { if (!cancelled) setTokenBalances([]); });
    return () => { cancelled = true; };
  }, [connection, publicKey]);

  const handleConnect = useCallback(() => setVisible(true), [setVisible]);

  const handleDisconnect = useCallback(() => {
    // ⚠️ REVERT volontaire : on ne vide PLUS le cache d'autorisation MWA ici.
    // Le vider forçait une renégociation complète de session à chaque
    // reconnexion (nouveau popup "Seed Vault veut se connecter"), et c'est
    // très probablement ce qui a cassé la signature juste après avoir eu 2
    // succès d'affilée avec la session mise en cache. Réutiliser la session
    // déjà autorisée est plus rapide et plus fiable — on accepte en échange
    // de ne plus pouvoir changer d'adresse via Seed Vault sans réinstaller/
    // révoquer manuellement l'autorisation côté OS si besoin.
    void disconnect()
      .catch((e) => console.warn('Déconnexion wallet : erreur non bloquante', e))
      .finally(() => {
        // ⚠️ BUG FIX : sans ça, autoConnect (WalletProvider) relisait cette
        // clé juste après le reload et reconnectait tout seul le même wallet
        // d'extension (Phantom/Backpack) — disconnect() ne peut pas révoquer
        // la permission côté extension, il efface juste la session locale.
        // Résultat observé : "déconnecter" puis l'adresse réapparaît connectée
        // immédiatement (le fix précédent de l'utilisateur = vider les cookies,
        // ce qui effaçait cette même clé par effet de bord).
        try {
          localStorage.removeItem('walletName');
        } catch {
          /* localStorage indisponible (navigation privée...) — non bloquant */
        }
        window.location.reload();
      });
  }, [disconnect]);

  return (
    <WalletButton
      connected={connected}
      connecting={connecting}
      address={publicKey ? publicKey.toBase58() : null}
      balance={balance}
      tokenBalances={tokenBalances}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
    />
  );
}

export default AppWalletButton;

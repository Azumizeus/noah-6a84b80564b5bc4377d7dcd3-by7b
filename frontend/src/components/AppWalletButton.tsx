// src/components/AppWalletButton.tsx
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import WalletButton from './WalletButton';

export function AppWalletButton() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    let cancelled = false;
    connection.getBalance(publicKey)
      .then((l) => { if (!cancelled) setBalance(l / LAMPORTS_PER_SOL); })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [connection, publicKey]);

  const handleConnect = useCallback(() => setVisible(true), [setVisible]);
  const handleDisconnect = useCallback(() => {
  void disconnect().finally(() => window.location.reload());
}, [disconnect]);

  return (
    <WalletButton
      connected={connected}
      connecting={connecting}
      address={publicKey ? publicKey.toBase58() : null}
      balance={balance}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
    />
  );
}

export default AppWalletButton;

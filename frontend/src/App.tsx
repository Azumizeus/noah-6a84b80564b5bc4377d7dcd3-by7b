import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute } from './lib/router';
import DashboardPage from './pages/DashboardPage';
import PactsPage from './pages/PactsPage';
import TreasuryPage from './pages/TreasuryPage';
import DocsPage from './pages/DocsPage';

import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );
  const route = useHashRoute();

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {route === '/pacts' ? (
            <PactsPage />
          ) : route === '/treasury' ? (
            <TreasuryPage />
          ) : route === '/docs' ? (
            <DocsPage />
          ) : (
            <DashboardPage />
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

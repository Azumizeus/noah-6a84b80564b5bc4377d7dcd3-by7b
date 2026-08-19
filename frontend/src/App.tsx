import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute } from './lib/router';
import DashboardPage from './pages/DashboardPage';
import PactsPage from './pages/PactsPage';
import TreasuryPage from './pages/TreasuryPage';
import DocsPage from './pages/DocsPage';

import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  const route = useHashRoute();

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      {/* Liste vide → Wallet Standard auto-détecte Phantom/Solflare/Seeker */}
      <WalletProvider wallets={[]} autoConnect>
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

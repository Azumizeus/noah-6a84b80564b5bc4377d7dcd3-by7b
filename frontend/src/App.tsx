import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { RPC_ENDPOINT } from './lib/constants';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './pages/DashboardPage';

import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <DashboardLayout walletSlot={<WalletMultiButton />}>
            <DashboardPage />
          </DashboardLayout>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

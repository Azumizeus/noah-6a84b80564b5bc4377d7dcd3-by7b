// src/pages/DashboardPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import WalletButton from '../components/WalletButton';
import StatsCard from '../components/StatsCard';
import PactCard from '../components/PactCard';
import EmptyState from '../components/EmptyState';

type Pact = {
  id: string;
  title: string;
  counterparty: string;
  shareBps: number;
  claimable: number;
  totalEarned: number;
  status: 'active' | 'pending' | 'closed';
  lastClaimAt?: string;
};

// Données démo des pactes — remplacées par les comptes Anchor à la phase suivante
const PACTS: Pact[] = [
  { id: 'pact-01', title: 'Revenue Share — Marketplace Fees', counterparty: '9WzD…E9gC',
    shareBps: 2500, claimable: 12.5, totalEarned: 87.3124, status: 'active', lastClaimAt: 'il y a 2 h' },
  { id: 'pact-02', title: 'NFT Royalties — Genesis Drop', counterparty: '5HsT…kL9p',
    shareBps: 1000, claimable: 5.9231, totalEarned: 32.1047, status: 'active', lastClaimAt: 'il y a 1 j' },
  { id: 'pact-03', title: 'Validator Commission Split', counterparty: '2PcE…mN7r',
    shareBps: 5000, claimable: 0, totalEarned: 23.1189, status: 'pending', lastClaimAt: 'il y a 3 j' },
  { id: 'pact-04', title: 'Q1 Bonus — Closed Pact', counterparty: '7FkL…tR4s',
    shareBps: 1500, claimable: 0, totalEarned: 5.0, status: 'closed', lastClaimAt: 'il y a 14 j' },
];

export function DashboardPage() {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [balance, setBalance] = useState<number | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Solde réel du wallet connecté (devnet)
  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    let cancelled = false;
    connection
      .getBalance(publicKey)
      .then((lamports) => { if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL); })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [connection, publicKey]);

  // Ouvre la VRAIE modale de sélection de wallet (Phantom, Solflare…)
  const handleConnect = useCallback(() => setVisible(true), [setVisible]);

  const handleDisconnect = useCallback(() => { void disconnect(); }, [disconnect]);

  // Claim : exige un wallet connecté — l'appel Anchor au program arrive à la phase suivante
  const handleClaim = useCallback(
    (id: string) => {
      if (!connected) { setVisible(true); return; }
      setClaimingId(id);
      window.setTimeout(() => setClaimingId(null), 1500);
    },
    [connected, setVisible],
  );

  return (
    <DashboardLayout
      walletSlot={
        <WalletButton
          connected={connected}
          connecting={connecting}
          address={publicKey ? publicKey.toBase58() : null}
          balance={balance}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      }
    >
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">
            Revenue Share Protocol
          </p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Your on-chain earnings, <span className="text-accent-violet">unlocked.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Visualisez, réclamez et suivez vos pactes de partage de revenus en temps réel sur Solana devnet.
          </p>
        </header>
      </FadeInUp>

      <section aria-label="Statistiques globales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FadeInUp><StatsCard label="Total Earned" value={142.587} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel="Lifetime on-chain" /></FadeInUp>
        <FadeInUp><StatsCard label="Claimable" value={18.423} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel="Ready to claim now" /></FadeInUp>
        <FadeInUp><StatsCard label="Active Pacts" value={7} decimals={0} icon="pacts" accent="gold" sublabel="2 pending signature" /></FadeInUp>
      </section>

      <FadeInUp>
        <div className="mb-4 mt-10 flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold text-white">Active Pacts</h2>
          <a href="#/pacts" className="text-sm text-ink-300 underline-offset-4 hover:text-white hover:underline">View all</a>
        </div>
      </FadeInUp>

      {PACTS.length === 0 ? (
        <FadeInUp>
          <EmptyState title="Aucun pact actif" description="Créez votre premier pact de partage de revenus pour commencer à percevoir vos royalties on-chain." ctaLabel="Create a Pact" onCta={() => undefined} />
        </FadeInUp>
      ) : (
        <section aria-label="Liste des pactes" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PACTS.map((p) => (
            <FadeInUp key={p.id}>
              <PactCard id={p.id} title={p.title} counterparty={p.counterparty} shareBps={p.shareBps}
                claimable={p.claimable} totalEarned={p.totalEarned} status={p.status}
                lastClaimAt={p.lastClaimAt} onClaim={handleClaim} claiming={claimingId === p.id} />
            </FadeInUp>
          ))}
        </section>
      )}
    </DashboardLayout>
  );
}

export default DashboardPage;

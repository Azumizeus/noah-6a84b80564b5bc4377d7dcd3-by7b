// src/pages/TreasuryPage.tsx
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import StatsCard from '../components/StatsCard';

const FLOWS = [
  { id: 'f1', label: 'Distribution — Marketplace Fees', amount: '+12.5000 SOL', when: 'il y a 2 h' },
  { id: 'f2', label: 'Distribution — NFT Royalties', amount: '+5.9231 SOL', when: 'il y a 1 j' },
  { id: 'f3', label: 'Claim — Member 2PcE…mN7r', amount: '−0.8420 SOL', when: 'il y a 2 j' },
  { id: 'f4', label: 'Deposit — Genesis Drop mint', amount: '+9.4100 SOL', when: 'il y a 3 j' },
];

export function TreasuryPage() {
  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Treasury</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Trésorerie du <span className="text-accent-violet">protocole</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Vue consolidée du vault et des flux de distribution on-chain.
          </p>
        </header>
      </FadeInUp>

      <section aria-label="Statistiques trésorerie" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FadeInUp><StatsCard label="Total Value Locked" value={214.631} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel="Vault PDA" /></FadeInUp>
        <FadeInUp><StatsCard label="Distributed" value={168.241} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel="Depuis le début" /></FadeInUp>
        <FadeInUp><StatsCard label="Pending Claims" value={18.423} decimals={3} suffix="SOL" icon="pacts" accent="gold" sublabel="En attente de claim" /></FadeInUp>
      </section>

      <FadeInUp>
        <h2 className="mb-4 mt-10 font-sans text-lg font-semibold text-white">Flux récents</h2>
      </FadeInUp>

      <FadeInUp>
        <ul className="glass-panel divide-y divide-violet-500/10">
          {FLOWS.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-sm text-white">{f.label}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-500">{f.when}</p>
              </div>
              <p className={'font-mono text-sm tabular-nums ' + (f.amount.startsWith('+') ? 'text-accent-neon' : 'text-accent-gold')}>
                {f.amount}
              </p>
            </li>
          ))}
        </ul>
      </FadeInUp>
    </DashboardLayout>
  );
}

export default TreasuryPage;

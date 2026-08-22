// src/pages/TreasuryPage.tsx
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';
import StatsCard from '../components/StatsCard';
<<<<<<< HEAD

const FLOWS = [
  { id: 'f1', label: 'Distribution — Marketplace Fees', amount: '+12.5000 SOL', when: 'il y a 2 h' },
  { id: 'f2', label: 'Distribution — NFT Royalties', amount: '+5.9231 SOL', when: 'il y a 1 j' },
  { id: 'f3', label: 'Claim — Member 2PcE…mN7r', amount: '−0.8420 SOL', when: 'il y a 2 j' },
  { id: 'f4', label: 'Deposit — Genesis Drop mint', amount: '+9.4100 SOL', when: 'il y a 3 j' },
];

export function TreasuryPage() {
=======
import { useTreasury } from '../hooks/useProjects';
import { explorerTxUrl, formatSol } from '../lib/pacts';
import { downloadTreasuryCsv, downloadTreasuryJson } from '../lib/exportTreasury';
import { useLanguage } from '../lib/i18n/LanguageContext';

export function TreasuryPage() {
  const { t } = useLanguage();

  function timeAgo(unixSeconds: number | null): string {
    if (!unixSeconds) return '';
    const diffMs = Date.now() - unixSeconds * 1000;
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return t('treasury.justNow');
    if (min < 60) return t('treasury.minAgo', { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t('treasury.hAgo', { n: h });
    const d = Math.floor(h / 24);
    return t('treasury.dAgo', { n: d });
  }

  const { totalValueLockedSol, distributedRecentSol, pendingClaimsSol, flows, loading, error } = useTreasury();

>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
<<<<<<< HEAD
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Treasury</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Trésorerie du <span className="text-accent-violet">protocole</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            Vue consolidée du vault et des flux de distribution on-chain.
=======
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">{t('treasury.eyebrow')}</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('treasury.titleLine1')} <span className="text-accent-violet">{t('treasury.titleLine2')}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-300">
            {t('treasury.subtitle')}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
          </p>
        </header>
      </FadeInUp>

<<<<<<< HEAD
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
=======
      {error && (
        <FadeInUp>
          <p className="mt-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {t('common.rpcErrorPrefix')} {error}
          </p>
        </FadeInUp>
      )}

      <section aria-label={t('treasury.eyebrow')} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="glass-panel h-28 animate-pulse rounded-2xl" aria-hidden="true" />
          ))
        ) : (
          <>
            <FadeInUp><StatsCard label={t('treasury.statTvlLabel')} value={totalValueLockedSol} decimals={3} suffix="SOL" icon="earned" accent="violet" sublabel={t('treasury.statTvlSublabel')} /></FadeInUp>
            <FadeInUp><StatsCard label={t('treasury.statDistributedLabel')} value={distributedRecentSol} decimals={3} suffix="SOL" icon="claimable" accent="neon" sublabel={t('treasury.statDistributedSublabel')} /></FadeInUp>
            <FadeInUp><StatsCard label={t('treasury.statPendingLabel')} value={pendingClaimsSol} decimals={3} suffix="SOL" icon="pacts" accent="gold" sublabel={t('treasury.statPendingSublabel')} /></FadeInUp>
          </>
        )}
      </section>

      <FadeInUp>
        <div className="mb-4 mt-10 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-lg font-semibold text-white">{t('treasury.recentFlows')}</h2>
          {!loading && flows.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadTreasuryCsv(flows)}
                className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 hover:border-accent-violet/40 hover:text-white"
              >
                {t('treasury.exportCsv')}
              </button>
              <button
                type="button"
                onClick={() => downloadTreasuryJson(flows, { totalValueLockedSol, distributedRecentSol, pendingClaimsSol })}
                className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-ink-300 hover:border-accent-violet/40 hover:text-white"
              >
                {t('treasury.exportJson')}
              </button>
            </div>
          )}
        </div>
      </FadeInUp>

      {!loading && flows.length === 0 && (
        <FadeInUp>
          <p className="glass-panel px-4 py-6 text-center text-sm text-ink-400">
            {t('treasury.emptyFlows')}
          </p>
        </FadeInUp>
      )}

      {flows.length > 0 && (
        <FadeInUp>
          <ul className="glass-panel divide-y divide-violet-500/10">
            {flows.map((f) => (
              <li key={f.signature} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <a
                    href={explorerTxUrl(f.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-white underline-offset-2 hover:text-accent-neon hover:underline"
                  >
                    {f.label} — {f.projectTitle}
                  </a>
                  <p className="mt-0.5 font-mono text-xs text-ink-400">{timeAgo(f.when)}</p>
                </div>
                <p className={'shrink-0 font-mono text-sm tabular-nums ' + (f.amountSol > 0 ? 'text-accent-neon' : 'text-accent-gold')}>
                  {f.amountSol > 0 ? '+' : '−'}{formatSol(Math.abs(f.amountSol))} SOL
                </p>
              </li>
            ))}
          </ul>
        </FadeInUp>
      )}
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
    </DashboardLayout>
  );
}

export default TreasuryPage;

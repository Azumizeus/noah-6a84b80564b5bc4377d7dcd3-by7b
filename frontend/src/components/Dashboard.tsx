import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Dashboard() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="relative min-h-screen">
      {/* Background FX */}
      <div className="bg-grid" />
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">

        {/* ===== HEADER ===== */}
        <header className="flex items-center justify-between pb-6 mb-10 border-b border-[rgba(153,69,255,.2)] fade-in-up">
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide text-gradient">
              BuildPact
            </h1>
            <p className="mono text-[10px] tracking-[.25em] text-[rgba(20,241,149,.75)] mt-1">
              SOLANA REVENUE SHARE
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="badge-devnet">
              <span className="dot pulse-dot" />
              DEVNET
            </span>
            <WalletMultiButton />
          </div>
        </header>

        {!connected ? (
          <>
            {/* ===== HERO (déconnecté) ===== */}
            <div className="text-center py-16 fade-in-up delay-1">
              <div className="text-6xl mb-6">🔐</div>
              <h2 className="text-4xl font-extrabold mb-4">
                Pacts de revenus <span className="text-gradient-violet">on-chain</span>
              </h2>
              <p className="text-[rgba(255,255,255,.6)] text-lg max-w-xl mx-auto mb-3">
                Crée un pact, verrouille les parts, encaisse, distribue.
              </p>
              <p className="mono text-sm text-[#14F195] mb-10">
                Zéro confiance requise.
              </p>
              <div className="inline-block">
                <WalletMultiButton />
              </div>
              <p className="mono text-xs text-[rgba(255,255,255,.35)] mt-6">
                Connecte ton wallet Phantom (devnet) pour commencer
              </p>
            </div>

            {/* ===== FEATURES ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
              <div className="glass p-6 fade-in-up delay-2">
                <div className="text-3xl mb-4">🤝</div>
                <h3 className="font-bold text-base mb-2">Créer un Pact</h3>
                <p className="text-sm text-[rgba(255,255,255,.55)] leading-relaxed">
                  Définis les participants et leurs parts en basis points. Immuable, on-chain.
                </p>
              </div>
              <div className="glass p-6 fade-in-up delay-3">
                <div className="text-3xl mb-4">🔒</div>
                <h3 className="font-bold text-base mb-2">Verrouiller</h3>
                <p className="text-sm text-[rgba(255,255,255,.55)] leading-relaxed">
                  Une fois verrouillé, personne ne peut modifier la répartition. Même pas toi.
                </p>
              </div>
              <div className="glass p-6 fade-in-up delay-4">
                <div className="text-3xl mb-4">💸</div>
                <h3 className="font-bold text-base mb-2">Distribuer</h3>
                <p className="text-sm text-[rgba(255,255,255,.55)] leading-relaxed">
                  Les revenus arrivent, chacun réclame sa part. Trustless, automatique.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ===== DASHBOARD (connecté) ===== */}
            <div className="glass-static p-6 mb-8 fade-in-up delay-1">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="mono text-[10px] tracking-[.2em] text-[rgba(255,255,255,.4)] mb-1">
                    WALLET CONNECTÉ
                  </p>
                  <p className="mono text-sm text-[#14F195]">
                    {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                  </p>
                </div>
                <button className="btn-primary">
                  + Nouveau Pact
                </button>
              </div>
            </div>

            {/* ===== STATS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <div className="glass p-6 fade-in-up delay-2">
                <p className="mono text-[10px] tracking-[.2em] text-[rgba(255,255,255,.4)] mb-2">
                  MES PACTS
                </p>
                <p className="text-4xl font-extrabold text-gradient-violet">0</p>
              </div>
              <div className="glass p-6 fade-in-up delay-3">
                <p className="mono text-[10px] tracking-[.2em] text-[rgba(255,255,255,.4)] mb-2">
                  TOTAL REÇU
                </p>
                <p className="text-4xl font-extrabold text-[#14F195]">0 <span className="text-lg">SOL</span></p>
              </div>
              <div className="glass p-6 fade-in-up delay-4">
                <p className="mono text-[10px] tracking-[.2em] text-[rgba(255,255,255,.4)] mb-2">
                  À RÉCLAMER
                </p>
                <p className="text-4xl font-extrabold text-[#FFD700]">0 <span className="text-lg">SOL</span></p>
              </div>
            </div>

            {/* ===== EMPTY STATE ===== */}
            <div className="glass-static p-12 text-center fade-in-up delay-4">
              <div className="text-5xl mb-4 opacity-60">📜</div>
              <h3 className="font-bold text-lg mb-2">Aucun pact pour le moment</h3>
              <p className="text-sm text-[rgba(255,255,255,.5)] mb-6">
                Crée ton premier pact de revenus ou rejoins-en un existant.
              </p>
              <button className="btn-ghost">
                Créer mon premier pact →
              </button>
            </div>
          </>
        )}

        {/* ===== FOOTER ===== */}
        <footer className="text-center mt-16 pt-8 border-t border-[rgba(153,69,255,.15)]">
          <p className="mono text-[10px] text-[rgba(255,255,255,.3)] tracking-wider">
            BUILDPACT · SOLANA DEVNET · TRUSTLESS REVENUE SHARE
          </p>
        </footer>
      </div>
    </div>
  );
}

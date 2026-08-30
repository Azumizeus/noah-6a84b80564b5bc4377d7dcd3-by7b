import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { mwaAuthCache } from './lib/mwaAuthCache';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute, usePactPdaParam } from './lib/router';
import { useChatSessionCleanup } from './hooks/useChatSessionCleanup';
import { useEffect } from 'react';
import { LanguageProvider } from './lib/i18n/LanguageContext';
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import { fetchProfile } from './lib/profileRemote';
import SeekerNexusBadge from './components/SeekerNexusBadge';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import PactsPage from './pages/PactsPage';
import MarketplacePage from './pages/MarketplacePage';
import AboutPage from './pages/AboutPage';
import DocsPage from './pages/DocsPage';
import PactPublicPage from './pages/PactPublicPage';
import MonProfilPage from './pages/MonProfilPage';
import TreasuryPage from './pages/TreasuryPage';
import BuildersPage from './pages/BuildersPage';
import NetworkPage from './pages/NetworkPage';
import LeaderboardPage from './pages/LeaderboardPage';

import '@solana/wallet-adapter-react-ui/styles.css';

// ─── Racine '/' : landing marketing (visiteur non connecté) vs Dashboard
// (stats perso, une fois un wallet connecté) — même route, rendu conditionnel
// sur l'état de connexion. Évite d'introduire une route dédiée juste pour ça.
function RootRoute() {
  const { connected } = useWallet();
  return connected ? <DashboardPage /> : <LandingPage />;
}

// Purge les jetons de session du chat dès que le wallet se déconnecte ou
// change de compte. Sans rendu : il doit vivre à l'intérieur du
// WalletProvider (il lit useWallet) et rester monté sur toutes les routes,
// puisqu'on se déconnecte rarement depuis la page d'un chat.
function ChatSessionCleanup() {
  useChatSessionCleanup();
  return null;
}

// Applique automatiquement, à la connexion d'un wallet, le thème que ce
// builder a enregistré sur son profil (builder_profiles.theme_palette) —
// sans ça, le choix ne suit que ce NAVIGATEUR (ThemeContext, localStorage
// par wallet), jamais l'appareil. Lecture publique (fetchProfile), aucune
// signature requise. Sans rendu, doit vivre sous ThemeProvider.
function ThemePreferenceSync() {
  const { publicKey } = useWallet();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    fetchProfile(publicKey.toBase58()).then((profile) => {
      if (cancelled || !profile?.themePalette) return;
      setTheme(profile.themePalette);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  return null;
}

// ⚠️ REVERT volontaire vers SolanaMobileWalletAdapter (package legacy) après
// une tentative de migration vers registerMwa (package "recommandé") qui a
// dégradé la fiabilité au lieu de l'améliorer. C'est CETTE configuration
// exacte (SolanaMobileWalletAdapter + VersionedTransaction dans anchor.ts)
// qui a produit 2 signatures réussies d'affilée sur Seed Vault natif. On ne
// change plus rien ici tant que ce n'est pas retesté et confirmé stable.
//
// ⚠️ FIX appIdentity.uri : cette valeur était codée en dur sur une ANCIENNE
// URL de déploiement Vercel (buildpact-9y9o4gx0g-...). Or Vercel génère une
// URL différente à CHAQUE déploiement — on en a eu au moins 6 différentes
// pendant cette session. Une identité d'app qui ne correspond pas à l'origine
// réelle de la page peut perturber l'autorisation MWA de façon incohérente.
// On utilise maintenant window.location.origin, qui s'adapte automatiquement.
// Aussi aligné sur `chain: 'solana:devnet'` (équivalent à cluster: 'devnet'
// en interne, mais c'est la forme qui a été confirmée fonctionner ailleurs).
export default function App() {
  const wallets = useMemo(
    () => [
      // ⭐ MWA — Seed Vault / Seeker (critère hackathon)
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'BuildPact',
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          icon: '/favicon.ico',
        },
        authorizationResultCache: mwaAuthCache,
        chain: 'solana:devnet',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );
  const route = useHashRoute();
  const pactPda = usePactPdaParam();

  return (
    <LanguageProvider>
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        <WalletProvider wallets={wallets} autoConnect>
          {/* ThemeProvider DOIT être à l'intérieur du WalletProvider : il lit
              useWallet() pour mémoriser la palette par wallet. Monté au-dessus,
              il planterait au rendu. */}
          <ThemeProvider>
          <WalletModalProvider>
            <ChatSessionCleanup />
            <ThemePreferenceSync />
            {/* key = route active : un changement de route démonte/remonte ce
                wrapper, ce qui rejoue .page-transition-in (voir index.css).
                Pas de logique de timing en JS — juste un remount React. */}
            <div key={pactPda ?? route} className="page-transition-in">
              {pactPda ? (
                <PactPublicPage pda={pactPda} />
              ) : route === '/pacts' ? (
                <PactsPage />
              ) : route === '/marketplace' ? (
                <MarketplacePage />
              ) : route === '/docs' ? (
                <DocsPage />
              ) : route === '/profile' ? (
                <MonProfilPage />
              ) : route === '/treasury' ? (
                <TreasuryPage />
              ) : route === '/builders' ? (
                <BuildersPage />
              ) : route === '/network' ? (
                <NetworkPage />
              ) : route === '/leaderboard' ? (
                <LeaderboardPage />
              ) : route === '/about' ? (
                <AboutPage />
              ) : route === '/home' ? (
                // Page d'accueil marketing, toujours accessible via l'icône du
                // logo — même si un wallet est connecté (contrairement à '/'
                // qui bascule sur le Dashboard une fois connecté).
                <LandingPage />
              ) : (
                <RootRoute />
              )}
            </div>
            {/* Badge d'écosystème — flottant, présent sur toutes les routes,
                à l'emplacement de l'ancien badge injecté par l'outil. */}
            <SeekerNexusBadge />
          </WalletModalProvider>
          </ThemeProvider>
        </WalletProvider>
      </ConnectionProvider>
    </LanguageProvider>
  );
}

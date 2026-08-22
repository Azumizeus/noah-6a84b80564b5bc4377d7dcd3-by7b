import { useMemo } from 'react';
<<<<<<< HEAD
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
=======
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
<<<<<<< HEAD
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute } from './lib/router';
import DashboardPage from './pages/DashboardPage';
import PactsPage from './pages/PactsPage';
import TreasuryPage from './pages/TreasuryPage';
import DocsPage from './pages/DocsPage';

import '@solana/wallet-adapter-react-ui/styles.css';

=======
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { mwaAuthCache } from './lib/mwaAuthCache';
import { RPC_ENDPOINT } from './lib/constants';
import { useHashRoute, usePactPdaParam } from './lib/router';
import { LanguageProvider } from './lib/i18n/LanguageContext';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import PactsPage from './pages/PactsPage';
import MarketplacePage from './pages/MarketplacePage';
import TreasuryPage from './pages/TreasuryPage';
import DocsPage from './pages/DocsPage';
import AboutPage from './pages/AboutPage';
import PactPublicPage from './pages/PactPublicPage';
import MonProfilPage from './pages/MonProfilPage';
import BuildersPage from './pages/BuildersPage';

import '@solana/wallet-adapter-react-ui/styles.css';

// ─── Racine '/' : landing marketing (visiteur non connecté) vs Dashboard
// (stats perso, une fois un wallet connecté) — même route, rendu conditionnel
// sur l'état de connexion. Évite d'introduire une route dédiée juste pour ça.
function RootRoute() {
  const { connected } = useWallet();
  return connected ? <DashboardPage /> : <LandingPage />;
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
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
export default function App() {
  const wallets = useMemo(
    () => [
      // ⭐ MWA — Seed Vault / Seeker (critère hackathon)
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'BuildPact',
<<<<<<< HEAD
          uri: 'https://buildpact-9y9o4gx0g-azumizeus-projects.vercel.app',
          icon: 'favicon.ico',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: 'devnet',
=======
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          icon: '/favicon.ico',
        },
        authorizationResultCache: mwaAuthCache,
        chain: 'solana:devnet',
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );
  const route = useHashRoute();
<<<<<<< HEAD

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
=======
  const pactPda = usePactPdaParam();

  return (
    <LanguageProvider>
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {pactPda ? (
              <PactPublicPage pda={pactPda} />
            ) : route === '/pacts' ? (
              <PactsPage />
            ) : route === '/marketplace' ? (
              <MarketplacePage />
            ) : route === '/profile' ? (
              <MonProfilPage />
            ) : route === '/builders' ? (
              <BuildersPage />
            ) : route === '/treasury' ? (
              <TreasuryPage />
            ) : route === '/docs' ? (
              <DocsPage />
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
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </LanguageProvider>
>>>>>>> fa844dd29fb2795b6a94555f7fd306add97458a3
  );
}

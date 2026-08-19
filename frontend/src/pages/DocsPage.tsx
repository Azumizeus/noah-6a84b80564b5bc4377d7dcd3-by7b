// src/pages/DocsPage.tsx
import { DashboardLayout, FadeInUp } from '../components/DashboardLayout';
import AppWalletButton from '../components/AppWalletButton';

const SECTIONS = [
  { id: 'quickstart', title: 'Quickstart', body: 'Connectez votre wallet Phantom ou Solflare sur devnet. Le dashboard affiche vos pactes, vos parts et vos gains réclamables.' },
  { id: 'create', title: 'Créer un pact', body: 'Un pact définit les membres, leurs parts en basis points (total 10 000) et un vault PDA. Toute distribution est on-chain et vérifiable.' },
  { id: 'claim', title: 'Réclamer vos gains', body: 'Les revenus s\'accumulent dans le vault du pact. Le bouton Claim transfère votre part directement vers votre wallet.' },
  { id: 'security', title: 'Sécurité', body: 'Program Anchor non audité — devnet uniquement. N\'utilisez jamais ce protocole avec des fonds réels sur mainnet.' },
];

export function DocsPage() {
  return (
    <DashboardLayout walletSlot={<AppWalletButton />}>
      <FadeInUp>
        <header className="mb-6 sm:mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent-neon">Documentation</p>
          <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Comment fonctionne <span className="text-accent-violet">BuildPact</span>
          </h1>
        </header>
      </FadeInUp>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <FadeInUp key={s.id}>
            <article className="glass-panel glass-panel-hover h-full p-5">
              <h2 className="font-sans text-base font-semibold text-white">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.body}</p>
            </article>
          </FadeInUp>
        ))}
      </section>

      <FadeInUp>
        <p className="mt-8 font-mono text-xs text-ink-500">
          Program ID : <span className="text-accent-violet">266V7Jct…T59kQ</span> · Cluster : devnet ·{' '}
          <a href="https://docs.solana.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-white">
            Solana docs ↗
          </a>
        </p>
      </FadeInUp>
    </DashboardLayout>
  );
}

export default DocsPage;

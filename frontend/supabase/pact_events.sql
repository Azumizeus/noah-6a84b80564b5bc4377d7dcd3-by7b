-- ═══════════════════════════════════════════════════════
-- BuildPact — Fil d'activité par projet (Supabase Realtime)
-- À exécuter dans Supabase SQL Editor
-- ⚠️ Cette table est un JOURNAL D'AFFICHAGE, pas la source de vérité :
--    chaque ligne référence une signature de transaction déjà confirmée
--    on-chain (colonne tx_sig). En cas de doute, l'explorer Solana fait foi.
-- ═══════════════════════════════════════════════════════

-- 1. TABLE
create table if not exists public.pact_events (
  id           bigint generated always as identity primary key,
  project_pda  text    not null,   -- PDA du projet concerné (base58)
  kind         text    not null,   -- 'approve' | 'fund' | 'finalize' | 'distribute' | 'add_member'
  actor        text    not null,   -- wallet base58 qui a signé la transaction
  amount_sol   numeric,            -- montant SOL si pertinent (fund/distribute), sinon null
  tx_sig       text    not null,   -- signature de transaction — preuve on-chain vérifiable
  created_at   timestamptz not null default now(),

  constraint project_pda_format_chk
    check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint actor_format_chk
    check (actor ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint kind_chk
    check (kind in ('approve', 'fund', 'finalize', 'distribute', 'add_member'))
);

-- Index pour le filtre par projet (utilisé par la souscription Realtime + le fetch initial)
create index if not exists pact_events_project_pda_idx
  on public.pact_events (project_pda, created_at desc);

-- 2. RLS — OBLIGATOIRE avec la publishable key
alter table public.pact_events enable row level security;

-- Lecture publique (fil d'activité = preuve publique par design, cf. règle
-- "aucune donnée mock" — un juge doit pouvoir vérifier chaque ligne)
create policy "pact_events_public_read"
  on public.pact_events for select
  using (true);

-- Écriture ouverte en MVP (même modèle que builder_profiles) — chaque ligne
-- n'est écrite qu'APRÈS confirmation on-chain de tx_sig côté client, donc le
-- pire cas d'abus est un faux événement d'affichage, jamais un faux paiement.
create policy "pact_events_public_insert"
  on public.pact_events for insert
  with check (true);

-- 3. Realtime — active la réplication logique pour cette table
alter publication supabase_realtime add table public.pact_events;

-- 4. Vérif — doit retourner 0 ligne sans erreur
select * from public.pact_events;

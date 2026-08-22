-- ═══════════════════════════════════════════════════════
-- BuildPact — Fil d'avancement des membres (project_updates)
-- À exécuter dans Supabase SQL Editor, après project_media.sql
-- ⚠️ Off-chain volontairement, même modèle de confiance que role_interests /
--    pact_events / project_media : pas de vérification serveur de signature
--    wallet à ce stade (MVP). Les membres postent un court texte + un lien
--    optionnel ("Milestone X fait"), affiché en liste chronologique sur la
--    fiche publique du pact.
-- ═══════════════════════════════════════════════════════

create table if not exists public.project_updates (
  id            bigint generated always as identity primary key,
  project_pda   text not null,
  author_wallet text not null,
  body          text not null,
  link          text,
  created_at    timestamptz not null default now(),

  constraint project_pda_format_chk check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint author_wallet_format_chk check (author_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint body_not_empty_chk check (char_length(trim(body)) > 0),
  constraint body_len_chk check (char_length(body) <= 500),
  constraint link_len_chk check (link is null or char_length(link) <= 300)
);

-- La fiche publique charge "les mises à jour de CE projet, les plus récentes
-- d'abord" — cet index sert exactement cette requête.
create index if not exists project_updates_project_pda_idx
  on public.project_updates (project_pda, created_at desc);

alter table public.project_updates enable row level security;

drop policy if exists "project_updates_public_read" on public.project_updates;
create policy "project_updates_public_read"
  on public.project_updates for select
  using (true);

drop policy if exists "project_updates_public_insert" on public.project_updates;
create policy "project_updates_public_insert"
  on public.project_updates for insert
  with check (true);

-- Pas de policy update/delete : un post reste tel quel une fois publié
-- (comme pact_events) — simplicité MVP, cohérent avec "journal d'avancement".

-- Vérif — doit retourner 0 ligne sans erreur
select * from public.project_updates;

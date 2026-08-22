-- ═══════════════════════════════════════════════════════
-- BuildPact — Notation des builders (1 à 6 étoiles)
-- À exécuter dans Supabase SQL Editor
--
-- ⚠️ SÉCURISÉ dès le départ — même modèle que le vault et les demandes de
-- contact (v2) : table fermée par RLS, AUCUNE policy publique en
-- écriture/lecture individuelle. Toute écriture passe par l'Edge Function
-- `contact` (action 'rate'), qui vérifie une signature signMessage avant
-- d'utiliser la service_role key. Un wallet ne peut noter un autre wallet
-- qu'UNE fois (contrainte unique from_wallet/to_wallet) — renoter met juste
-- à jour la note existante (upsert), pas de ballot-stuffing possible.
--
-- Seule la MOYENNE agrégée (vue publique, comme project_documents_summary)
-- est lisible publiquement — jamais qui a mis quelle note à qui.
-- ═══════════════════════════════════════════════════════

-- 1. TABLE
create table if not exists public.builder_ratings (
  id          bigserial primary key,
  from_wallet text        not null,
  to_wallet   text        not null,
  stars       smallint    not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint from_wallet_format_chk check (from_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint to_wallet_format_chk check (to_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint stars_range_chk check (stars between 1 and 6),
  constraint no_self_rating_chk check (from_wallet <> to_wallet),
  constraint unique_rating_pair unique (from_wallet, to_wallet)
);

create index if not exists builder_ratings_to_idx
  on public.builder_ratings (to_wallet);

-- 2. RLS — table fermée : AUCUNE policy = zéro accès via clé anon/authenticated.
-- Seule l'Edge Function `contact` (service_role) peut écrire/lire le détail.
alter table public.builder_ratings enable row level security;

-- 3. VUE PUBLIQUE — moyenne + nombre de notes uniquement, jamais le détail
-- (qui a noté qui, ni avec combien d'étoiles individuellement). Une vue
-- tourne avec les droits de son propriétaire (postgres), donc elle
-- contourne le "aucune policy = fermé" de la table de base — volontaire et
-- scopé à ces colonnes agrégées seulement, même pattern que
-- project_documents_summary (vault).
create or replace view public.builder_ratings_summary as
  select to_wallet,
         round(avg(stars)::numeric, 1) as avg_stars,
         count(*)::int as rating_count
  from public.builder_ratings
  group by to_wallet;

grant select on public.builder_ratings_summary to anon, authenticated;

-- 4. Vérif — doit retourner 0 ligne sans erreur
select * from public.builder_ratings;

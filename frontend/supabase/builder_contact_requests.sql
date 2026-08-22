-- ═══════════════════════════════════════════════════════
-- BuildPact — Demandes de contact entre builders
-- À exécuter dans Supabase SQL Editor
--
-- ⚠️ SÉCURISÉ (v2) — même modèle que project_documents (vault) et
-- builder_profiles : table fermée par RLS, AUCUNE policy publique. Toute
-- écriture ET lecture passe par l'Edge Function `contact`
-- (supabase/functions/contact), qui vérifie une signature signMessage côté
-- serveur avant d'utiliser la service_role key (bypass RLS). Ça remplace la
-- v1 (écriture ET lecture publiques, façon chat) : ici on prouve
-- cryptographiquement qui envoie ET qui a le droit de lire ses propres
-- demandes reçues — plus d'usurpation possible du "from_wallet", et plus
-- personne ne peut lire les demandes adressées à quelqu'un d'autre.
-- ═══════════════════════════════════════════════════════

-- 1. TABLE
create table if not exists public.builder_contact_requests (
  id          bigserial primary key,
  from_wallet text        not null,
  to_wallet   text        not null,
  role_text   text        not null default '',
  message     text        not null default '',
  created_at  timestamptz not null default now(),

  constraint from_wallet_format_chk check (from_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint to_wallet_format_chk check (to_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint role_text_len_chk check (char_length(role_text) <= 60),
  constraint message_len_chk check (char_length(message) <= 500)
);

create index if not exists builder_contact_requests_to_idx
  on public.builder_contact_requests (to_wallet, created_at desc);

-- 2. RLS — table fermée : AUCUNE policy = zéro accès via clé anon/authenticated.
-- Seule l'Edge Function `contact` (service_role) peut lire/écrire.
alter table public.builder_contact_requests enable row level security;

-- ⚠️ Anciennes policies v1 (écriture/lecture publiques) — supprimées
-- explicitement. Ne PAS les recréer : la v2 exige signature + Edge Function.
drop policy if exists "contact_public_insert" on public.builder_contact_requests;
drop policy if exists "contact_public_read" on public.builder_contact_requests;

-- 3. Vérif — doit retourner 0 ligne sans erreur
select * from public.builder_contact_requests;

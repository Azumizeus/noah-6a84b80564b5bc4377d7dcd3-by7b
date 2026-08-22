-- ═══════════════════════════════════════════════════════
-- BuildPact — Chat simple par projet (Supabase Realtime)
-- À exécuter dans Supabase SQL Editor
-- ⚠️ Modèle de confiance MVP volontaire, comme pact_events/project_updates :
-- écriture publique, pas de vérification serveur de signature. Pire cas
-- d'abus = un faux message affiché dans le chat d'un projet, jamais un faux
-- paiement ni une usurpation d'identité durable (contrairement au profil
-- builder, qui lui passe par l'Edge Function signée — voir builder_profiles.sql).
-- ═══════════════════════════════════════════════════════

create table if not exists public.project_chat_messages (
  id            bigint generated always as identity primary key,
  project_pda   text not null,
  author_wallet text not null,
  body          text not null,
  created_at    timestamptz not null default now(),

  constraint project_pda_format_chk check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint author_wallet_format_chk check (author_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint body_not_empty_chk check (char_length(trim(body)) > 0),
  constraint body_len_chk check (char_length(body) <= 500)
);

create index if not exists project_chat_messages_project_pda_idx
  on public.project_chat_messages (project_pda, created_at asc);

alter table public.project_chat_messages enable row level security;

drop policy if exists "project_chat_public_read" on public.project_chat_messages;
create policy "project_chat_public_read"
  on public.project_chat_messages for select
  using (true);

drop policy if exists "project_chat_public_insert" on public.project_chat_messages;
create policy "project_chat_public_insert"
  on public.project_chat_messages for insert
  with check (true);

-- Realtime — active la réplication logique pour cette table
alter publication supabase_realtime add table public.project_chat_messages;

-- Vérif — doit retourner 0 ligne sans erreur
select * from public.project_chat_messages;

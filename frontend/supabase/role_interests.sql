-- ═══════════════════════════════════════════════════════
-- BuildPact — Candidatures sur les rôles ouverts (Marketplace)
-- À exécuter dans Supabase SQL Editor
-- ⚠️ Off-chain volontairement : le programme Anchor n'a pas d'instruction
--    "postuler" (add_member est founder-only). Ajouter cette instruction
--    demanderait de redéployer le programme à 4 jours de la deadline —
--    trop risqué. Cette table est juste un carnet de candidatures que le
--    founder consulte, la décision d'ajouter le membre reste on-chain
--    via add_member.
-- ═══════════════════════════════════════════════════════

create table if not exists public.role_interests (
  id                bigint generated always as identity primary key,
  project_pda       text    not null,   -- PDA du projet visé (base58)
  role_wanted       text    not null,   -- rôle pour lequel on postule
  applicant_wallet  text    not null,   -- wallet du candidat (base58)
  message           text    not null default '',
  created_at        timestamptz not null default now(),

  constraint project_pda_format_chk check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint applicant_wallet_format_chk check (applicant_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint message_len_chk check (char_length(message) <= 400)
);

create index if not exists role_interests_project_pda_idx
  on public.role_interests (project_pda, created_at desc);

alter table public.role_interests enable row level security;

-- Lecture publique — le founder doit voir les candidatures, et c'est
-- cohérent avec la règle "aucune donnée mock" : tout est vérifiable.
create policy "role_interests_public_read"
  on public.role_interests for select
  using (true);

-- Écriture ouverte en MVP (même modèle que builder_profiles / pact_events)
create policy "role_interests_public_insert"
  on public.role_interests for insert
  with check (true);

-- Vérif — doit retourner 0 ligne sans erreur
select * from public.role_interests;

-- ═══════════════════════════════════════════════════════
-- BuildPact — Rôles recherchés par un pact ("open roles")
-- À exécuter dans Supabase SQL Editor
-- ⚠️ Off-chain volontairement : le compte Project on-chain n'a pas de
--    champ "rôles recherchés" et la description est plafonnée à 280
--    octets (déjà pleine : stage + pitch + rôles founder + seed).
--    Modifier le programme changerait le layout du compte → casserait
--    les pacts existants. Cette table est de la métadonnée transitoire
--    (un rôle pourvu disparaît), donc off-chain comme project_media.
-- Écriture : UNIQUEMENT via l'Edge Function `open-roles` (signMessage +
-- vérification on-chain que le signataire est project.creator) — aucune
-- policy d'insert/update/delete publique ici.
-- ═══════════════════════════════════════════════════════

create table if not exists public.project_open_roles (
  id           bigint generated always as identity primary key,
  project_pda  text    not null,   -- PDA du projet (base58)
  role_label   text    not null,   -- ex. "Lead Dev", "Designer UI/UX"
  position     integer not null default 0, -- ordre d'affichage
  created_at   timestamptz not null default now(),

  constraint project_pda_format_chk check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint role_label_len_chk check (char_length(role_label) between 1 and 40)
);

create index if not exists project_open_roles_project_pda_idx
  on public.project_open_roles (project_pda, position);

alter table public.project_open_roles enable row level security;

-- Lecture publique — tout visiteur doit voir ce qu'un pact recherche
-- (cohérent avec role_interests / project_media).
create policy "project_open_roles_public_read"
  on public.project_open_roles for select
  using (true);

-- ⚠️ AUCUNE policy insert/update/delete : l'écriture ne peut passer que
-- par l'Edge Function `open-roles` (service_role key, qui bypass RLS),
-- après vérification signature + creator on-chain.

-- Vérif — doit retourner 0 ligne sans erreur
select * from public.project_open_roles;

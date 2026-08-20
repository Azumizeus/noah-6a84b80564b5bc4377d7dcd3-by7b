-- ═══════════════════════════════════════════════════════
-- BuildPact — Table des profils builders
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. TABLE
create table if not exists public.builder_profiles (
  wallet       text primary key,
  display_name text    not null default '',
  bio          text    not null default '',
  roles        text[]  not null default '{}',
  skills       text[]  not null default '{}',
  links        jsonb   not null default '{}'::jsonb,   -- {twitter, github, discord, website}
  available    boolean not null default true,           -- ouvert aux propositions
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Format base58 Solana (32-44 chars, alphabet sans 0/O/I/l)
  constraint wallet_format_chk
    check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

-- 2. updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_builder_profiles_updated on public.builder_profiles;
create trigger trg_builder_profiles_updated
  before update on public.builder_profiles
  for each row execute function public.set_updated_at();

-- 3. RLS — OBLIGATOIRE avec la publishable key
alter table public.builder_profiles enable row level security;

-- Lecture publique (annuaire de builders = public par design)
create policy "profiles_public_read"
  on public.builder_profiles for select
  using (true);

-- Écriture ouverte en MVP (voir note sécurité ci-dessous)
create policy "profiles_public_insert"
  on public.builder_profiles for insert
  with check (true);

create policy "profiles_public_update"
  on public.builder_profiles for update
  using (true) with check (true);

-- 4. Vérif — doit retourner 0 ligne sans erreur
select * from public.builder_profiles;

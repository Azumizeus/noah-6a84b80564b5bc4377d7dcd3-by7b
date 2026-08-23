-- ═══════════════════════════════════════════════════════
-- BuildPact — Table des profils builders
-- À exécuter dans Supabase SQL Editor
-- ⚠️ SÉCURITÉ : contrairement à project_media/pact_events/project_updates
-- (MVP à écriture publique, risque assumé), un profil est lié à une IDENTITÉ
-- de wallet — laisser n'importe qui écrire ici permettrait d'usurper le
-- profil de quelqu'un d'autre. Donc AUCUNE policy d'insert/update publique
-- ici : la seule façon d'écrire est via l'Edge Function `update-profile`
-- (supabase/functions/update-profile), qui vérifie une signature signMessage
-- côté serveur avant d'utiliser la service_role key (qui bypass RLS par
-- design chez Supabase). Si tu relances ce script après une version
-- précédente plus permissive, les anciennes policies sont supprimées.
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
    check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint display_name_len_chk check (char_length(display_name) <= 40),
  constraint bio_len_chk check (char_length(bio) <= 280)
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
drop policy if exists "profiles_public_read" on public.builder_profiles;
create policy "profiles_public_read"
  on public.builder_profiles for select
  using (true);

-- ⚠️ Anciennes policies d'écriture ouverte (versions précédentes de ce
-- fichier) — supprimées explicitement. Ne PAS les recréer : l'écriture ne
-- doit passer QUE par l'Edge Function (service_role, hors RLS).
drop policy if exists "profiles_public_insert" on public.builder_profiles;
drop policy if exists "profiles_public_update" on public.builder_profiles;

-- 4. AVATAR — photo de profil (ajouté après coup, idempotent si déjà exécuté)
alter table public.builder_profiles
  add column if not exists avatar_url text;

-- 4bis. NIVEAU PAR COMPÉTENCE (débutant / confirmé / expert) — jsonb
-- {roleId: niveau}, ajouté après coup, idempotent si déjà exécuté.
alter table public.builder_profiles
  add column if not exists skill_levels jsonb not null default '{}'::jsonb;

-- ⚠️ Filet de sécurité : `create table if not exists` ne touche PAS à une
-- table qui existe déjà (elle est juste ignorée), donc si cette table a été
-- créée avec une version plus ancienne du script (avant l'ajout de
-- `available`), la colonne peut manquer réellement en base même si elle
-- apparaît ci-dessus dans le CREATE TABLE — d'où l'erreur PostgREST
-- "Could not find the 'available' column ... in the schema cache". Ces
-- ALTER idempotents rattrapent toutes les colonnes de la table courante,
-- quelle que soit la version du script qui l'a créée à l'origine.
alter table public.builder_profiles add column if not exists display_name text not null default '';
alter table public.builder_profiles add column if not exists bio text not null default '';
alter table public.builder_profiles add column if not exists roles text[] not null default '{}';
alter table public.builder_profiles add column if not exists skills text[] not null default '{}';
alter table public.builder_profiles add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.builder_profiles add column if not exists available boolean not null default true;

-- ⚠️ Cette table a visiblement été créée à l'origine avec un schéma plus
-- ancien que celui-ci (ex: une colonne "pseudo" NOT NULL sans défaut —
-- probablement l'ancien nom de display_name avant un renommage côté code
-- jamais répercuté en base). L'Edge Function update-profile n'écrit QUE les
-- colonnes listées dans son upsert() (wallet, display_name, bio, roles,
-- skills, links, available, avatar_url) — toute autre colonne NOT NULL
-- orpheline fait échouer CHAQUE enregistrement de profil avec une erreur
-- différente à chaque fois. Filet générique : on retire NOT NULL de toute
-- colonne qui n'a ni défaut ni valeur fournie par l'Edge Function, plutôt
-- que de corriger colonne par colonne à chaque nouveau message d'erreur.
do $$
declare
  col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'builder_profiles'
      and is_nullable = 'NO'
      and column_default is null
      and column_name <> 'wallet' -- clé primaire, toujours fournie
  loop
    execute format('alter table public.builder_profiles alter column %I drop not null', col.column_name);
  end loop;
end $$;

-- Force PostgREST à rafraîchir son cache de schéma tout de suite (sinon
-- l'API peut continuer à renvoyer "column not found" pendant ~1 minute
-- après un ALTER TABLE fait manuellement dans le SQL Editor).
notify pgrst, 'reload schema';

-- Bucket public : une photo de profil doit s'afficher partout (chat, fil
-- d'avancement...) sans signature ni URL temporaire — contrairement au vault
-- (project-documents), ce n'est pas confidentiel. L'écriture reste fermée à
-- la clé anon : seule l'Edge Function update-profile (signature vérifiée)
-- génère une signed upload URL, même schéma que project_media.
insert into storage.buckets (id, name, public)
values ('builder-avatars', 'builder-avatars', true)
on conflict (id) do update set public = true;

-- 5. Vérif — doit retourner 0 ligne sans erreur
select * from public.builder_profiles;

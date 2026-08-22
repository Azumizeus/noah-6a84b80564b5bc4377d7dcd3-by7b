-- ═══════════════════════════════════════════════════════
-- BuildPact — Logo & bannière de projet (visibilité pour attirer
-- dons/investisseurs)
-- À exécuter dans Supabase SQL Editor
-- ⚠️ Off-chain volontairement, comme role_interests/pact_events : stocker
--    des images on-chain serait hors de prix (le compte Project a déjà un
--    budget d'octets serré). Le programme Anchor n'est pas touché.
-- ═══════════════════════════════════════════════════════

-- ── 1. Bucket de stockage public pour les images ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-media',
  'project-media',
  true,
  5242880, -- 5 Mo max par fichier (la bannière est la plus grosse contrainte)
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Lecture publique des fichiers (les images doivent s'afficher sans wallet,
-- comme la fiche publique #/pact/:pda).
-- NB : CREATE POLICY ne supporte pas IF NOT EXISTS → drop-puis-create pour
-- que ce script reste rejouable sans erreur.
drop policy if exists "project_media_storage_public_read" on storage.objects;
create policy "project_media_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'project-media');

-- Écriture ouverte en MVP (même modèle de confiance que role_interests /
-- pact_events : pas de vérification serveur de signature wallet à ce stade).
drop policy if exists "project_media_storage_public_insert" on storage.objects;
create policy "project_media_storage_public_insert"
  on storage.objects for insert
  with check (bucket_id = 'project-media');

drop policy if exists "project_media_storage_public_update" on storage.objects;
create policy "project_media_storage_public_update"
  on storage.objects for update
  using (bucket_id = 'project-media');

-- ── 2. Table de référence : 1 ligne par projet, les 2 URLs publiques ──
create table if not exists public.project_media (
  project_pda  text primary key,      -- PDA du projet (base58) — clé canonique
  logo_url     text,
  banner_url   text,
  updated_at   timestamptz not null default now(),

  constraint project_pda_format_chk check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);

alter table public.project_media enable row level security;

drop policy if exists "project_media_public_read" on public.project_media;
create policy "project_media_public_read"
  on public.project_media for select
  using (true);

drop policy if exists "project_media_public_insert" on public.project_media;
create policy "project_media_public_insert"
  on public.project_media for insert
  with check (true);

drop policy if exists "project_media_public_update" on public.project_media;
create policy "project_media_public_update"
  on public.project_media for update
  using (true);

-- ── 3. Vidéo de présentation founder — lien externe (YouTube/Loom/Vimeo),
--    pas d'upload de fichier. Rejouable : ajoute la colonne seulement si
--    elle n'existe pas déjà (ce script peut être relancé sans casse).
alter table public.project_media add column if not exists pitch_video_url text;

-- Vérif — doit retourner 0 ligne sans erreur
select * from public.project_media;

-- ═══════════════════════════════════════════════════════
-- BuildPact — Vault de documents privés par projet
-- À exécuter dans Supabase SQL Editor
--
-- ⚠️ SÉCURITÉ — différent de project_media/pact_events/project_updates
-- (MVP à écriture publique, risque assumé) : un document déposé ici est
-- CONFIDENTIEL (travail rendu, livrable...), il ne doit être visible QUE
-- par les membres du projet concerné (+ modifiable en statut que par le
-- founder). RLS ne peut pas vérifier "est membre de ce projet on-chain"
-- directement (Postgres n'a pas accès au programme Solana), donc :
--   - AUCUNE policy select/insert/update publique ici (RLS activée, table
--     fermée par défaut à la clé anon/authenticated).
--   - Toute lecture/écriture passe par l'Edge Function `vault`
--     (supabase/functions/vault), qui vérifie une signature signMessage
--     PUIS l'appartenance au projet en lisant le compte Project on-chain,
--     avant d'utiliser la service_role key (bypass RLS par design chez
--     Supabase — c'est la seule porte d'entrée).
--   - Le bucket Storage 'project-documents' est privé (public=false) :
--     aucune URL publique, seules des signed URLs à durée de vie courte
--     (générées par l'Edge Function, service_role) permettent l'accès.
-- ═══════════════════════════════════════════════════════

-- 1. TABLE
create table if not exists public.project_documents (
  id            bigserial primary key,
  project_pda   text        not null,
  uploader_wallet text      not null,
  title         text        not null default '',
  file_path     text        not null,        -- chemin dans le bucket project-documents
  mime_type     text        not null default 'application/octet-stream',
  size_bytes    bigint      not null default 0,
  status        text        not null default 'pending',
  founder_note  text        not null default '',
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),

  constraint project_pda_format_chk
    check (project_pda ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint uploader_wallet_format_chk
    check (uploader_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  constraint title_len_chk check (char_length(title) <= 120),
  constraint founder_note_len_chk check (char_length(founder_note) <= 500),
  constraint status_chk check (status in ('pending', 'approved', 'changes_requested')),

  -- Historique de versions : un ré-upload (ex. après "demande de changements")
  -- pointe vers la version qu'il remplace au lieu de l'écraser. NULL = première
  -- version. On chaîne (v3 → v2 → v1) plutôt que de stocker un doc_group_id fixe,
  -- ce qui reste simple côté SQL ; le regroupement en chaîne se fait côté client
  -- (voir lib/vault.ts groupVaultVersions()).
  supersedes_id bigint references public.project_documents(id) on delete set null
);

create index if not exists project_documents_project_idx
  on public.project_documents (project_pda, created_at desc);

-- Idempotent si la table existait déjà avant l'ajout de l'historique de versions.
alter table public.project_documents
  add column if not exists supersedes_id bigint references public.project_documents(id) on delete set null;

-- 2. RLS — table fermée : AUCUNE policy = zéro accès via clé anon/authenticated.
-- Seule l'Edge Function vault (service_role) peut lire/écrire.
alter table public.project_documents enable row level security;

-- ⚠️ Pas de policy créée ici volontairement — voir commentaire d'en-tête.

-- 3. BUCKET STORAGE PRIVÉ — public=false, pas d'URL publique possible.
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do update set public = false;

-- storage.objects a RLS activée par défaut chez Supabase et aucune policy
-- n'est ajoutée ici : la clé anon ne peut ni lire ni écrire dans ce bucket,
-- seules les signed URLs générées par l'Edge Function (service_role,
-- bypass RLS) donnent un accès temporaire et ciblé à un fichier précis.

-- 4. VUE PUBLIQUE LÉGÈRE — pour un badge "nouveau document" côté UI, SANS
-- exposer le contenu confidentiel. Expose uniquement un compteur + la date
-- du dernier upload par projet — jamais le titre, le statut ou le fichier.
-- L'existence d'un projet et ses membres sont déjà publics on-chain, donc ce
-- niveau d'info ne réduit pas la confidentialité réelle des documents
-- eux-mêmes (toujours protégés par signature + vérif on-chain côté Edge
-- Function). Une vue tourne avec les droits de son propriétaire (postgres),
-- donc elle contourne le "aucune policy = fermé" de la table de base — c'est
-- volontaire et scope à ces 2 colonnes seulement.
create or replace view public.project_documents_summary as
  select project_pda, count(*)::int as doc_count, max(created_at) as latest_at
  from public.project_documents
  group by project_pda;

grant select on public.project_documents_summary to anon, authenticated;

-- 5. Vérif — doit retourner 0 ligne sans erreur
select * from public.project_documents;

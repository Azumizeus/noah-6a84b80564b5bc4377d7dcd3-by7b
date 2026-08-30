-- Marqueur : déploiement de l'Edge Function `project-write`.
-- Aucune modification de schéma. Sert uniquement à horodater dans
-- l'historique des migrations le moment où l'écriture des tables
-- pact_events / project_updates / role_interests / project_media est
-- passée exclusivement par la fonction.
select 1;
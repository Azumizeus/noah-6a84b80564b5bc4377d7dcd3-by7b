# 🗺️ BUILDPACT — FEUILLE DE ROUTE HACKATHON (20 → 26 août 2026)

## 🔐 INFOS VERROUILLÉES
- Program ID : 9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ (⚠️ mis à jour le
  22/08 — l'ancien `266V7Jct...` ci-dessous a été fermé et est mort/irrécupérable)
- Config PDA : 5yRNQhn7W6sCFNVWhTWbZowQRKL7dNSaqYkpTtPxEF2C
- Fee : 200 bps (2%) → AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH | Devnet

## ✅ FAIT
Program Anchor (create/add_member/remove_member/approve/finalize/fund/distribute/close_project) ·
Frontend Vercel · Wizard 3 étapes (pleine largeur, logo/bannière/vidéo) ·
Reprise pact orphelin · AddMemberModal (multi-rôles, pleine largeur, total
des parts visible) · Marketplace/Discovery · Fiche pact publique (QR, partage,
historique on-chain, fil d'avancement membres) · Treasury données réelles ·
Docs/About refondues · Audit A11y WCAG 2.1 AA · 3 bugs wallet fiabilité
corrigés (rotation RPC retry, déconnexion autoConnect, messages d'erreur RPC) ·
i18n FR/EN complet (landing incluse) · Profil builder sécurisé (signMessage +
avatar + niveau de compétence + mode aperçu/édition + export PDF) · Vault de
documents privés par projet (signature + vérif on-chain, historique de
versions) · Chat + fil d'avancement par projet · Annuaire des builders
(recherche, notation 1-6 étoiles, demandes de contact) — tout sécurisé par
signature wallet, aucune écriture publique non vérifiée.

## 📅 PLAN
### J-6 (20/08) — Nettoyage & Rust — ✅ FAIT
- [x] Supprimer vestiges Vault (frontend + state inutile)
- [x] `close_project` (creator only, si non finalisé, vault vide) → récupère rent
- [x] `remove_member` (creator, tant que pending) + tests → redéployé devnet

### J-5 (21-22/08) — Fiche projet — ✅ FAIT
- [x] Page projet détaillée : description, rôles ouverts, % shares, équipe, roadmap
- [x] Bouton "Postuler à un rôle" / "Financer"
- [ ] `cancel_pact` UI (creator) — pas fait, scope réduit (pas critique démo)

### J-4 (22/08) — Marketplace (CRITIQUE démo) — ✅ FAIT
- [x] Page Discovery : tous les projets ouverts + filtres (rôle recherché, financement)
- [x] Cards : pitch, % restant, rôles dispo, montant financé
- [x] Bonus : logo/bannière/vidéo projet, fil d'avancement membres, liens
      historique on-chain (kit démo juges)

### J-3 (23/08) — Profil & Chat — ✅ FAIT (terminé en avance le 22/08)
- [x] Profil builder : signMessage → Supabase (bio, skills, liens, niveau de compétence, avatar)
- [x] Page profil : mes pacts, mes gains, historique, mode aperçu/édition
- [x] Chat simple par projet (Supabase Realtime)

### Hors plan (22/08, soir/nuit) — Vault, annuaire builders, sécurisation
- [x] Vault de documents privés par projet — upload membres, review founder,
      historique de versions (supersedes_id), signature + vérif on-chain
- [x] Annuaire builders (`/builders`) — recherche, filtre disponibilité
- [x] Demandes de contact entre builders — SÉCURISÉ (signature signMessage
      des 2 côtés, table fermée par RLS, Edge Function `contact`)
- [x] Notation des builders 1-6 étoiles — sécurisé dès le départ (signature +
      unicité par paire de wallets), moyenne publique via vue agrégée
- [x] Badges de notification (nouveau message/document) sur les cartes pact
- [x] Lien direct partageable vers un document du vault
- [x] Export PDF du profil builder
- [x] Fix bug fiabilité : signature wallet ne doit JAMAIS se déclencher
      automatiquement au chargement d'une page (popup instable) — exige
      systématiquement un clic explicite

### Hors plan (22/08, fin de nuit) — Finitions annuaire
- [x] Bouton "Discussion & Vault" masqué sur la fiche pact elle-même
      (redondant avec chat+vault déjà affichés en dessous) et réduit en
      taille partout ailleurs
- [x] Recherche de l'annuaire élargie : insensible aux accents/casse,
      cherche aussi bio + compétences (pas seulement le pseudo)
- [x] Fiche détaillée builder au clic sur une carte de l'annuaire (bio
      complète, compétences+niveaux, liens, wallet, note, bouton Contacter)
- [x] Investigation popup signature persistant sur Profil : code confirmé
      propre (aucun signMessage auto en useEffect) — hypothèse : build pas
      redéployé depuis le fix ; à confirmer après redeploy Vercel + hard
      refresh

### J-2 (24/08) — Sécurité & Polish
- [ ] Audit light CIPHER (signer/owner checks, seeds PDA)
- [ ] Polish UX/A11y (VERA) · microcopies (LINGUA FR/EN)
- [ ] Landing page publique — ✅ déjà faite (bilingue, hors plan initial)

### J-1 (25/08) — Pitch
- [ ] Script démo live : créer pact → membre → finalize → fund → distribute
- [ ] Vidéo démo 3 min · README premium · screenshots

### J-0 (26/08) — SOUMISSION
- [ ] Freeze code 12h00 · Soumission · Backup video si live demo échoue

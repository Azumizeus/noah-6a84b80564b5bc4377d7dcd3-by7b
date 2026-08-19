# 🗺️ BUILDPACT — FEUILLE DE ROUTE HACKATHON (20 → 26 août 2026)

## 🔐 INFOS VERROUILLÉES
- Program ID : 266V7Jct9EVWPeHscDwBpL13251EMUyak7WR9QiT59kQ
- Config PDA : 3XU92nh5keWtgT4XVrrWTqWUvvFismMSoBa5JCKKXRxY
- Fee : 200 bps (2%) → AVhVM29h... | Devnet | 8/8 tests ✅

## ✅ FAIT
Program Anchor (create/add_member/approve/finalize/fund/distribute) ·
Frontend Vercel · Wizard 3 étapes · Reprise pact orphelin · AddMemberModal

## 📅 PLAN
### J-6 (20/08) — Nettoyage & Rust
- [ ] Supprimer vestiges Vault (frontend + state inutile)
- [ ] `close_project` (creator only, si non finalisé, vault vide) → récupère rent
- [ ] `remove_member` (creator, tant que pending) + tests → redéployer devnet

### J-5 (21/08) — Fiche projet
- [ ] Page projet détaillée : description, rôles ouverts, % shares, équipe, roadmap
- [ ] Bouton "Postuler à un rôle" / "Financer"
- [ ] `cancel_pact` UI (creator)

### J-4 (22/08) — Marketplace (CRITIQUE démo)
- [ ] Page Discovery : tous les projets ouverts + filtres (rôle recherché, financement)
- [ ] Cards : pitch, % restant, rôles dispo, montant financé

### J-3 (23/08) — Profil & Chat
- [ ] Profil builder : signMessage → Supabase (bio, skills, liens)
- [ ] Page profil : mes pacts, mes gains, historique
- [ ] Chat simple par projet (Supabase Realtime)

### J-2 (24/08) — Sécurité & Polish
- [ ] Audit light CIPHER (signer/owner checks, seeds PDA)
- [ ] Polish UX/A11y (VERA) · microcopies (LINGUA FR/EN)
- [ ] Landing page publique

### J-1 (25/08) — Pitch
- [ ] Script démo live : créer pact → membre → finalize → fund → distribute
- [ ] Vidéo démo 3 min · README premium · screenshots

### J-0 (26/08) — SOUMISSION
- [ ] Freeze code 12h00 · Soumission · Backup video si live demo échoue

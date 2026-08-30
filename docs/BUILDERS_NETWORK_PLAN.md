# BuildPact — Plan « Profil + Réseau Builders »

> Écrit le 29 août 2026. Statut : **proposition, rien d'implémenté**.
> Demande d'origine : un profil plus riche façon réseau social, un onglet
> "Réseau Builders" où poster/partager/discuter, en prenant le meilleur de
> promethee.io. Question posée : le chat existant est-il relié à ce
> nouvel onglet ?

---

## 1. Ce qu'est promethee.io (visité en direct, 29/08)

Promethee est un réseau social pour builders/indie hackers, centré sur le
**"build in public" automatisé**. Ce qu'on voit dans le feed réel :

- Chaque post = une **session de travail**, trackée automatiquement par un
  agent local (durée : "4h 12m", "Personal best", "Longest this week",
  "First session today") + la **répartition du temps par app** utilisée
  pendant la session (Warp 49%, Chrome 35%, Figma 25%…) + un compteur de
  **tokens IA consommés** ou d'**XP**.
- Un texte libre optionnel accompagne la session ("Grosse session révision
  et coding en parallèle !"), parfois une photo hors-sujet (juste de la
  vie perso, façon Instagram).
- Réactions : **"Congratulated by X et N others"** (l'équivalent d'un
  like, mais formulé comme un encouragement entre pairs plutôt qu'un simple
  coeur — ton "on est ensemble dans le grind"), un compteur de commentaires.
- Accès par **code d'invitation** (gating, effet de rareté/communauté).

### Ce qu'on en prend, ce qu'on adapte, ce qu'on laisse

| Chez Promethee | Pour BuildPact |
|---|---|
| Tracking automatique du temps d'écran par un agent local | **Non transposable ni souhaitable** — BuildPact est une webapp, pas un agent desktop ; installer un tracker d'activité serait intrusif et hors sujet pour un protocole de financement. On garde le principe (montrer le travail réel) mais la source de vérité reste ce que BuildPact sait déjà : les transactions on-chain (approve/fund/finalize/distribute/create), pas le temps passé dans VS Code. |
| Post = update libre + stats de session | **Post = update libre**, sans les stats de session. Le "board" de vérité de BuildPact n'est pas le temps passé, c'est l'activité vérifiée (déjà exactement ce que `pact_events` capture). |
| "Congratulated by X et N others" | **Réaction "🤝 Encourager"** plutôt qu'un like générique — même ton pair-à-pair, cohérent avec le vocabulaire "pact"/"builders" déjà utilisé partout dans l'app. |
| Compteur XP par session | **Déjà couvert** par le système XP livré le 29/08 (voir `GAMIFICATION_PLAN.md`) — pas besoin de le dupliquer ici. |
| Accès par code d'invitation | Hors sujet pour un hackathon devnet public — pas repris. |

---

## 2. Le chat existant — et pourquoi il ne doit PAS fusionner avec le feed

Réponse directe à la question posée : **non**, `ChatBox.tsx` /
`project_chat_messages` n'est pas relié à un onglet réseau, et ne devrait
pas l'être telle quelle. Deux objets différents :

- **Chat existant** (`ChatBox.tsx`, table `project_chat_messages`) : Q&A
  **par pact**, éphémère, conversationnel, écriture via jeton de session
  signé 24h. Sert à négocier/discuter D'UN projet précis avec ses membres
  et curieux.
- **`project_updates`** (déjà existant aussi, `UpdatesFeed.tsx`) : c'est
  en réalité **déjà** un mini "build in public" — mais scoped à un seul
  pact ("Milestone X fait, avancement du design…"), pas un feed global.

Le vrai chaînon manquant que la demande d'origine décrit ("onglet réseau
builders où poster/partager/discuter") est un **troisième objet**, qui
n'existe pas encore : un feed **transverse à tous les builders**, pas
attaché à un pact précis. Le chat de pact reste ce qu'il est ; le nouveau
feed vit à côté, sur `/builders`, pas dans une fiche de pact.

Point de liaison léger et cohérent : un post du feed builders peut
**optionnellement** référencer un pact (`Je viens de finaliser [Seeker
Monitor] →`), avec un lien cliquable vers la fiche — sans que la structure
de données ou d'écriture soit partagée.

---

## 3. Design proposé

### 3.1 Profil enrichi (`MonProfilPage.tsx`)

Déjà en place : bio, skills, disponibilité, liens, **rang/XP/badges**
(livré 29/08). Ajouts proposés :

- **Bannière de profil** (image de couverture, comme les logos/bannières
  de pact — réutilise `MediaPicker`/`ImageHoverPreview` déjà existants).
- **Onglet "Mes posts"** sur le profil : les posts du builder, en lecture,
  dans l'ordre chronologique — son propre "build log" public.
- Le tout déjà cohérent avec le rang/XP existant : le rang affiché sur le
  profil devient le signal de confiance qui donne envie de lire les posts
  de quelqu'un, exactement le rôle que jouent les credentials Galxe
  (voir `GAMIFICATION_PLAN.md` §1).

### 3.2 Nouvel onglet "Réseau Builders" (nouvelle page, nouvelle nav)

Un feed chronologique, tous builders confondus :

- **Poster** : texte libre (≤ 500 caractères, même borne que
  `project_updates`), image optionnelle, lien optionnel vers un pact.
- **Encourager** (🤝) : une réaction par (post, wallet) — pas un système de
  likes à plusieurs emojis, pour rester simple et lisible.
- **Commenter** : fil de réponses sous un post, texte court (≤ 280).
- **Filtre** : "Tous" / "Mes pacts" (posts qui référencent un de tes
  pacts) / par rôle-compétence (réutilise `ALL_ROLES` déjà existant sur
  `BuildersPage`).
- Rang + avatar affichés sur chaque post (réutilise `RankBadge`).

### 3.3 Ce que l'XP NE fait PAS ici — principe important

Aucune XP n'est attribuée pour poster/commenter/encourager. Le système XP
livré le 29/08 tire toute sa crédibilité du fait qu'il ne mesure QUE des
actions on-chain vérifiées (voir `GAMIFICATION_PLAN.md`) — mélanger "j'ai
posté un texte" et "j'ai finalisé un pact financé en vrai" dans le même
score casserait ce qui fait la valeur du rang. Le feed a sa propre
monnaie sociale (encouragements, commentaires), séparée et volontairement
plus légère.

---

## 4. Architecture proposée

Même modèle de confiance que `project_updates`/`project-write` : écriture
via Edge Function + signature ed25519, jamais un insert client direct.

- **Nouvelles tables Supabase** :
  - `network_posts` (id, author_wallet, body, image_url, linked_project_pda
    nullable, created_at)
  - `network_post_reactions` (post_id, wallet, created_at — clé primaire
    composite `(post_id, wallet)`, empêche plusieurs encouragements du
    même wallet sur le même post)
  - `network_post_comments` (id, post_id, author_wallet, body, created_at)
- **Nouvelle Edge Function `network-write`** (plutôt que surcharger
  `project-write`, déjà dense) : actions `post`, `react`, `comment`,
  `delete-post` — même schéma de message signé que `UPDATE_RE` dans
  `project-write` (`BuildPact — post réseau\nWallet: …\nTimestamp: …`).
- **Composants** : `BuildersNetworkPage.tsx` (feed), `PostComposer.tsx`,
  `PostCard.tsx` (post + réactions + commentaires), `MyPostsTab.tsx`
  (sur le profil).
- **Nav** : nouvel onglet "Réseau" (`#/network`), à côté de "Builders"
  existant — ou fusion en un seul onglet à deux vues (annuaire / feed) ;
  à trancher selon préférence, les deux options sont détaillées ci-dessous.

### Option A — deux onglets séparés
`/builders` (annuaire, inchangé) + `/network` (feed). Simple, pas de
régression sur l'existant.

### Option B — un seul onglet à deux vues
`/builders` gagne un sélecteur "Annuaire / Feed" en haut de page. Plus
cohérent conceptuellement (un seul endroit "les gens"), demande de
retoucher `BuildersPage.tsx` au lieu d'ajouter une page à côté.

**Recommandation : Option A** pour la V1 — moins de risque de régresser
l'annuaire déjà fonctionnel, on fusionne plus tard si l'usage le justifie.

---

## 5. Plan d'implémentation, dans l'ordre

1. Migration Supabase : `network_posts`, `network_post_reactions`,
   `network_post_comments`.
2. Edge Function `network-write` (post / react / comment / delete-post),
   signature ed25519 fraîche, mêmes bornes anti-abus que `project-write`.
3. `PostComposer.tsx` + `PostCard.tsx`.
4. Page `BuildersNetworkPage.tsx` (`#/network`) + nav.
5. Onglet "Mes posts" sur `MonProfilPage.tsx`.
6. Bannière de profil (réutilise `MediaPicker`/`ImageHoverPreview`).

Rien ne touche au programme Anchor, ni au système XP déjà livré.

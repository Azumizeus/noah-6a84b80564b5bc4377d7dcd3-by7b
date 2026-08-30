# État de la restauration depuis GitHub — note de travail

Source de vérité : `https://github.com/Azumizeus/noah-6a84b80564b5bc4377d7dcd3-by7b`
Les fichiers du front y vivent sous `frontend/src/...`, ici sous `src/...`.
Raw : `https://raw.githubusercontent.com/Azumizeus/noah-6a84b80564b5bc4377d7dcd3-by7b/main/frontend/src/<chemin>`

## Constat

Ce workspace est une copie TRONQUÉE du vrai projet (212 commits côté GitHub).
Le repo GitHub contient 10 pages ; ce workspace n'en avait que 4, et les
versions présentes avaient divergé (props inventées, coquille `Index.tsx`
qui n'existe pas en amont).

## Déjà restauré à l'identique depuis GitHub

- `src/App.tsx` — routage par hash, providers wallet + MWA, LanguageProvider
  (⚠️ amputé temporairement des 4 routes manquantes, voir plus bas)
- `src/pages/LandingPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/AboutPage.tsx`
- `src/pages/DocsPage.tsx` — COMPLET, recollé en deux fois depuis le chat
  (guide 6 étapes, FAQ, glossaire, les 8 instructions, fonctionnalités
  plateforme, sécurité). Ma reconstruction intermédiaire a été jetée.
- `src/pages/MonProfilPage.tsx` — COMPLET, collé depuis le chat (édition de
  profil signée, upload avatar, niveaux de compétence, export PDF via
  `window.print()`, « Mes pacts & gains » on-chain, boîte de réception des
  demandes de contact). Route `#/profile` réactivée dans `App.tsx`.
  Toutes ses dépendances existaient déjà dans le workspace (`profile.ts`,
  `profileRemote.ts`, `contact.ts`, `roles.ts`, `StarRating`, `EmptyState`,
  `useProjects`) — aucun stub n'a été nécessaire.
- `src/pages/TreasuryPage.tsx` — COMPLET, collé depuis le chat (3 StatsCard
  TVL / Distributed / Pending, export CSV + JSON, liste des flux récents avec
  lien Explorer et horodatage relatif). Route `#/treasury` réactivée.
  Dépendances déjà présentes : `useTreasury` + `TreasuryFlow`
  (`hooks/useProjects.ts`), `downloadTreasuryCsv` / `downloadTreasuryJson`
  (`lib/exportTreasury.ts`), `explorerTxUrl` / `formatSol` (`lib/pacts.ts`),
  `StatsCard`. Le namespace `treasury.*` était déjà complet dans `fr.ts` /
  `en.ts`, y compris `justNow` / `minAgo` / `hAgo` / `dAgo`.
- `src/pages/BuildersPage.tsx` — COMPLET, collé depuis le chat (annuaire des
  profils, recherche normalisée sans accents sur pseudo/bio/compétences/wallet,
  filtre « disponibles uniquement », notation en étoiles avec rafraîchissement
  ciblé, modale de détail, modale de contact). Route `#/builders` réactivée.
  Dépendances déjà présentes : `listAllProfiles` (`lib/profileRemote.ts`),
  `fetchRatingSummaries` / `submitRating` / `RatingSummary` (`lib/contact.ts`),
  `BuilderDetailModal`, `ContactModal`, `StarRating`, `EmptyState`.
  Les namespaces `builders.*` et `contact.*` étaient déjà complets.

## Supprimé

- `src/pages/Index.tsx` — invention de ma part, n'existe pas en amont.
  Le vrai `App.tsx` fait le routage lui-même, sans coquille intermédiaire.

## Comparaison arborescente complète avec l'amont (28/08)

Listing GitHub confronté au workspace, dossier par dossier.

**Identique / complet**

- `pages/` — 10 fichiers amont, 10 présents ici. Plus aucun écran manquant.
- `hooks/` — 4 fichiers amont (`useActivityFeed`, `useOpenRoles`,
  `useProjectMedia`, `useProjects`), tous présents.
- `components/` — les 26 fichiers + `pact/` de l'amont sont tous présents.
- `lib/` — tous les modules amont sont présents.

**Écarts sans conséquence (le workspace a EN PLUS)**

- `components/ui/` + `hooks/use-mobile` / `use-toast` — scaffolding shadcn,
  absent de l'amont, inoffensif.
- `components/wizard/` (`PactStep1`, `PactStep3`, `TxLink`, `wizardShared`) —
  en amont `CreatePactWizard.tsx` est monolithique ; ici il a été découpé.
  Divergence de structure assumée, pas une perte.
- `components/MigratePactButton.tsx`, `lib/onchainLimits.ts` — n'existent pas
  en amont.
- `lib/i18n/` — amont = un seul `translations.ts` ; ici découpé en
  `en.ts` / `fr.ts` / `types.ts`. Contenu déjà vérifié plus complet (voir
  section i18n plus bas).
- `src/polyfills.ts` — local uniquement (Buffer/process pour Vite).

**`lib/vendor/` — RÉSOLU, ce n'était pas une lacune**

Le dossier amont ne contient qu'un fichier : `qrcode-generator.js`, la lib
de Kazuhiko Arase vendorée à la main. Ici elle est consommée via le package
npm `qrcode-generator` (déjà dans `package.json`), et `lib/qr.ts` documente
explicitement ce choix — API identique. Rien à rapatrier.

**`supabase/` — en cours de rapatriement**

Supabase est maintenant connecté au workspace. Le repo amont contient
`supabase/functions/` avec 4 Edge Functions ; état actuel :

- `contact/` — ✅ RAPATRIÉE (collée depuis le chat). Vérifie une signature
  ed25519 (`tweetnacl` + `bs58`) avant toute écriture, avec anti-replay sur
  le timestamp du message (5 min max, 1 min de dérive d'horloge tolérée).
  Trois actions : `send`, `rate` (upsert 1-6 étoiles), `list` (le wallet ne
  peut lire QUE les demandes dont il est destinataire).
- `open-roles/` — ✅ RAPATRIÉE (collée depuis le chat). L'anomalie signalée
  plus tôt s'explique : le dossier contient DEUX fichiers, `index.ts` et son
  `buildpact_idl.json`, et seul le second était remonté au premier coup
  d'œil. Action unique `set` : signature ed25519 + anti-replay, puis lecture
  du compte Project on-chain via Anchor pour vérifier que le signataire est
  bien `project.creator` (403 sinon), puis remplacement de la liste
  (delete + insert). `sanitizeRoles` trim, déduplique sans tenir compte de la
  casse, tronque à 40 octets et borne à 8 entrées.

  ⚠️ **L'IDL de cette fonction a été copié depuis `src/idl/buildpact.json`,
  PAS depuis la version collée dans le chat.** Celle-ci porte la coquille
  `"instructaions"` (voir section IDL plus bas) : `new Program()` aurait
  construit un programme sans instructions et `program.account.project.fetch`
  aurait échoué à chaque appel — la fonction aurait répondu « Projet
  introuvable on-chain » (404) sur des projets parfaitement valides.

  Note de version : `index.ts` importe `@coral-xyz/anchor@0.30.1` alors que
  le front est en 0.31.1. Sans effet ici — la fonction ne fait que décoder un
  compte, et le format d'IDL est le même depuis 0.30. Variable d'environnement
  optionnelle : `SOLANA_RPC_URL` (défaut `https://api.devnet.solana.com`).

  Contrat vérifié contre `lib/openRoles.ts` : message signé
  `BuildPact — rôles recherchés\nWallet: <w>\nProjet: <pda>\nTimestamp: <ms>`,
  compatible avec `message.includes(wallet)` et `/Timestamp:\s*(\d+)/`.
  Champs `action` / `wallet` / `projectPda` / `roles` alignés, et
  `MAX_OPEN_ROLES = 8` côté client correspond bien à `MAX_ROLES = 8`.

  Table requise : `project_open_roles` (`project_pda`, `role_label`,
  `position`), lecture publique RLS + aucune policy d'écriture.
  ✅ VÉRIFIÉ le 28/08 : la table existe bien, RLS activée. Fonction déployée
  (version 3, `verify_jwt: false`).
- `update-profile/` — ✅ RAPATRIÉE (collée depuis le chat). Même socle de
  vérification (ed25519 + anti-replay 5 min / 1 min de dérive) que `contact`,
  mais avec DEUX comportements selon le corps de la requête :

  1. `action: 'avatar-upload-url'` → renvoie une URL d'upload signée vers le
     bucket `builder-avatars`, sur le chemin `<wallet>/avatar.<ext>`. Le
     chemin étant dérivé du wallet PROUVÉ par signature, un utilisateur ne
     peut pas écraser l'avatar de quelqu'un d'autre, même en manipulant la
     requête. Garde-fous : PNG/JPEG/WebP/GIF, 2 Mo max.
  2. sans `action` → upsert du profil dans `builder_profiles` (`onConflict:
     'wallet'`).

  `sanitizeProfile` borne tout côté serveur : pseudo 40, bio 280, 20 rôles et
  20 compétences de 40 caractères, liens limités à 5 clés connues (`github`,
  `twitter`, `discord`, `website`, `portfolio`) de 300 caractères. Les
  `skill_levels` sont filtrés deux fois — la clé doit correspondre à une
  compétence réellement sélectionnée ET la valeur être `debutant` /
  `confirme` / `expert` — ce qui empêche d'accumuler des clés orphelines.

  Contrat vérifié contre `lib/profileRemote.ts` : message signé
  `BuildPact — mise à jour de profil\nWallet: <w>\nTimestamp: <ms>`, et le
  client envoie bien `display_name` / `roles` / `skills` / `skill_levels` /
  `links` / `available` / `avatar_url` en snake_case. Le mapping retour
  (`fromRemote`) relit ces mêmes colonnes, avec `available` booléen traduit
  en `'open'` / `'busy'` côté UI. `ALLOWED_AVATAR_TYPES` et
  `MAX_AVATAR_BYTES` (2 Mo) sont identiques des deux côtés.

  ⚠️ À noter : cette fonction renvoie volontairement le message d'erreur
  Postgres brut au client (choix MVP documenté dans le fichier). Pratique
  pour diagnostiquer une colonne manquante depuis l'UI, mais à refermer avant
  tout passage en mainnet.

  ✅ VÉRIFIÉ le 28/08 : la table `builder_profiles` existe (3 lignes, RLS
  activée) et le bucket `builder-avatars` existe bien en PUBLIC. Fonction
  déployée (version 4, `verify_jwt: false`).
- `vault/` — ✅ RAPATRIÉE (collée depuis le chat), avec son
  `buildpact_idl.json` — copié lui aussi depuis `src/idl/buildpact.json`,
  pour la même raison que `open-roles` (la version amont porte la coquille
  `"instructaions"`).

  Même socle que `open-roles` : signature ed25519 + anti-replay, puis lecture
  du compte Project on-chain. Mais ici le contrôle d'accès est à deux
  niveaux : `isMember()` (founder OU présent dans `project.members[]`) pour
  `upload-url` et `list`, `isFounder()` seul pour `review`. C'est le point
  important — la confidentialité des livrables ne repose PAS sur RLS
  (Postgres ne sait pas lire un compte Solana) mais entièrement sur cette
  fonction. La table `project_documents` et le bucket `project-documents`
  doivent donc rester TOTALEMENT fermés : toute policy de lecture publique
  ajoutée par erreur exposerait les documents privés de tous les projets.

  Trois actions :
  1. `upload-url` — valide la taille (15 Mo max), génère un chemin
     `<projectPda>/<uuid>`, crée la ligne en base avec `status: 'pending'`.
     `supersedesId` optionnel (nouvelle version d'un document) est vérifié
     comme appartenant au MÊME projet — sinon on pourrait chaîner sur le
     document d'un autre pact.
  2. `list` — régénère une signed URL de 10 min par document (le bucket étant
     privé, l'URL expire ; c'est voulu).
  3. `review` — `approved` ou `changes_requested` uniquement, note de 500
     caractères max, avec `.eq('project_pda', projectPda)` en garde-fou sur
     l'UPDATE.

  Contrat vérifié contre `lib/vault.ts` : message signé
  `BuildPact — accès au vault\nWallet: <w>\nTimestamp: <ms>`, upload direct au
  bucket via `uploadToSignedUrl(path, token, file)` — le fichier ne transite
  jamais par l'Edge Function. Les champs retournés correspondent un à un à
  l'interface `VaultDocument`, `supersedesId` inclus (utilisé par
  `groupVaultVersions` pour reconstituer les chaînes de versions côté client).

  Détail mineur : `PROGRAM_ID` est déclaré en tête du fichier mais jamais
  utilisé (l'IDL porte déjà l'adresse). Code mort inoffensif, laissé tel quel
  pour rester fidèle à l'amont.

  ✅ VÉRIFIÉ le 28/08 : la table `project_documents` existe (1 ligne, RLS
  activée), la vue `project_documents_summary` existe, et le bucket
  `project-documents` est bien PRIVÉ. Fonction déployée (version 2,
  `verify_jwt: false`).

Contrat client/serveur vérifié pour `contact` : `lib/contact.ts` envoie bien
`{ action, wallet, message, signature, ... }` et construit le message signé
au format `BuildPact — contact\nWallet: <w>\nTimestamp: <ms>` — compatible
avec les deux contrôles du serveur (`message.includes(wallet)` et le regex
`/Timestamp:\s*(\d+)/`). Les noms d'actions et les champs
(`toWallet` / `roleText` / `messageText` / `stars`) correspondent exactement.

✅ **Correction du 28/08 — le SQL EST bien en place.** Une note précédente
affirmait que la base était vide : c'était FAUX, l'inventaire n'avait pas été
fait contre le projet Supabase réel. Vérification directe effectuée :

| Objet | État |
|---|---|
| `builder_profiles` | ✅ 3 lignes, RLS on |
| `builder_contact_requests` | ✅ 1 ligne, RLS on |
| `builder_ratings` | ✅ 3 lignes, RLS on |
| `project_open_roles` | ✅ 0 ligne, RLS on |
| `project_documents` | ✅ 1 ligne, RLS on |
| `project_media` | ✅ 5 lignes, RLS on |
| `project_updates` | ✅ 2 lignes, RLS on |
| `project_chat_messages` | ✅ 3 lignes, RLS on |
| `project_messages` | ✅ 0 ligne, RLS on |
| `pact_events` | ✅ 44 lignes, RLS on |
| `role_interests` / `passes` | ✅ 0 ligne, RLS on |
| vue `builder_ratings_summary` | ✅ existe |
| vue `project_documents_summary` | ✅ existe |
| bucket `builder-avatars` | ✅ public |
| bucket `project-documents` | ✅ privé |
| bucket `project-media` | ✅ public |

Les 4 Edge Functions sont également DÉPLOYÉES et ACTIVE, toutes avec
`verify_jwt: false` comme requis : `contact` (v2), `open-roles` (v3),
`update-profile` (v4), `vault` (v2).

Migrations enregistrées : `20260823230307_add_about_text_to_project_media`,
`20260823235249_add_about_text_en_to_project_media`,
`20260824000706_add_delete_policy_project_chat_messages`. Le schéma initial a
donc été créé hors historique de migrations (dashboard ou SQL editor) — d'où
l'illusion d'une base vide si on se fie au seul `list_migrations`.

Leçon : ne jamais déduire l'état de la base depuis les fichiers du repo.
Interroger le projet connecté.

### Schéma désormais versionné (28/08)

Le schéma existait en base mais **nulle part dans le repo** : si le projet
Supabase disparaissait, il n'y avait rien à rejouer. Deux migrations
idempotentes ont été écrites ET appliquées pour corriger ça :

- `20260828103536_codify_builder_and_documents_schema` — décrit l'état réel
  des 5 tables (`builder_profiles`, `project_open_roles`,
  `builder_contact_requests`, `builder_ratings`, `project_documents`), leurs
  contraintes CHECK, index, la contrainte `unique_rating_pair`
  `(from_wallet, to_wallet)` dont dépend le `onConflict` de l'upsert de notes,
  les 2 vues d'agrégat et les 2 buckets.
- `20260828103602_tighten_summary_view_grants` — resserre les droits sur les
  vues.

Écrites en `create table if not exists` / `add constraint` sous garde
`pg_constraint` / `on conflict do update` : sur la base actuelle elles sont
un quasi no-op (aucune donnée touchée — les 3 profils, 3 notes, 1 contact et
1 document sont intacts), sur une base vierge elles recréent tout. **Ne jamais
les réécrire en `drop table` / `drop policy` sans garde** : ce serait
destructeur.

Modèle RLS retenu, à ne pas assouplir :

| Table | Policies | Effet |
|---|---|---|
| `builder_profiles` | 1 × SELECT public | annuaire lisible |
| `project_open_roles` | 1 × SELECT public | rôles ouverts lisibles |
| `builder_contact_requests` | aucune | fermée au client |
| `builder_ratings` | aucune | fermée au client |
| `project_documents` | aucune | fermée au client |

Aucune policy INSERT/UPDATE/DELETE nulle part : toute écriture passe par une
Edge Function qui vérifie la signature wallet puis écrit en `service_role`
(qui bypass RLS). Ajouter une policy d'écriture côté client casserait ce
modèle — un utilisateur pourrait écrire sous l'identité d'un autre wallet.

Deux corrections réelles apportées au passage :

1. `builder_profiles` portait **deux policies SELECT identiques**
   (`profiles_public_read` et `profiles_select_public`). Doublon sans effet
   fonctionnel, supprimé — il n'en reste qu'une.
2. Les deux vues héritaient des GRANT par défaut du schéma `public` : `anon`
   avait INSERT/UPDATE/DELETE/TRUNCATE dessus. Non exploitable (vues
   d'agrégat, non auto-updatables) mais retiré. Désormais
   `builder_ratings_summary` = SELECT seul pour `anon`/`authenticated`, et
   `project_documents_summary` = **aucun droit client** (même le nombre de
   documents révélerait l'activité privée d'un projet ; seule la fonction
   `vault` y accède).

⚠️ Point volontaire à connaître : `builder_ratings_summary` s'exécute avec les
droits de son propriétaire, elle **traverse donc le RLS** de
`builder_ratings`. C'est le mécanisme même qui permet d'exposer la moyenne et
le nombre de notes sans jamais exposer qui a noté qui. Un audit de sécurité
automatique le signalera comme un faux positif.

### Faille chat corrigée (28/08)

La migration `20260824000706` avait ajouté sur `project_chat_messages` une
policy `DELETE using (true)`. La modération était pensée founder-only, mais le
seul contrôle était l'affichage conditionnel du bouton `×` dans `ChatBox.tsx`.
Une policy ouverte s'applique à la clé anon publique : **n'importe qui pouvait
vider le chat de n'importe quel projet** par un appel REST direct.

Pourquoi aucune policy SQL ne peut corriger ça :

- « seul le founder » → `project.creator` est **on-chain**, Postgres l'ignore ;
- « seul l'auteur » → `author_wallet` est une colonne texte non authentifiée,
  n'importe qui peut insérer une ligne sous l'identité d'un autre wallet.

Sans preuve cryptographique, il n'y a rien à exprimer en SQL. Correction :

- migration `20260828110330_close_project_chat_delete_policy` — supprime la
  policy DELETE. Il ne reste que SELECT + INSERT publics.
- Edge Function **`chat-moderate`** (déployée, `verify_jwt: false`) — vérifie
  signature ed25519 + fraîcheur anti-rejeu, relit `project.creator` on-chain,
  puis supprime en `service_role`. Même pattern que `open-roles`.
- `deleteChatMessage()` prend désormais `{ id, projectPda, wallet, signMessage }`
  au lieu d'un simple `id`.

Deux détails à ne pas retirer en refactorisant :

1. le `.eq('project_pda', projectPda)` du DELETE serveur — sans lui, le founder
   du projet A pourrait supprimer les messages du projet B ;
2. la vérification que le message signé contient bien le `projectPda` **et**
   le `Message: <id>` ciblés — sinon une signature obtenue pour un couple
   pourrait être rejouée sur un autre.

`chat-moderate` lit le compte on-chain **sans Anchor ni IDL** : `creator` est
le premier champ de `Project`, donc octets 8..40, et le discriminant Anchor est
vérifié avant lecture (ce n'est pas un offset deviné). Si l'ordre des champs de
`Project` change dans `lib.rs`, **cette fonction casse silencieusement** — elle
renverra une mauvaise pubkey et refusera toute suppression.

### INSERT du chat fermé à son tour (28/08)

Même cause racine que le DELETE : `author_wallet` était une colonne texte
remplie par le client sous `INSERT with check (true)`. On pouvait donc poster
sous le wallet de n'importe qui, founder compris. Correction :

- migration `20260828114318_close_project_chat_insert_policy` — supprime la
  policy INSERT. **Il ne reste que `project_chat_public_read` (SELECT).**
- `chat-moderate` gagne une action `post` : signature vérifiée, puis insert en
  `service_role` avec `author_wallet` renseigné **par le serveur** à partir du
  wallet signataire — jamais depuis un champ client. C'est le cœur du correctif.
- `postChatMessage()` prend maintenant `signMessage` et retourne la ligne créée.

Points à ne pas casser en refactorisant :

1. **La policy SELECT publique doit rester.** Un abonnement Realtime
   `postgres_changes` est filtré par les droits SELECT du *client abonné* — pas
   par ceux de l'écrivain. La retirer rendrait le chat muet alors même que les
   inserts continueraient de passer. C'est un mode de panne silencieux.
2. Le texte signé embarque un **SHA-256 du corps** (`Contenu: <hash>`), vérifié
   côté serveur. Sans ce lien, une signature interceptée permettrait de publier
   un contenu arbitraire sous l'identité de son auteur. On signe le hash et non
   le corps brut pour aussi empêcher un utilisateur d'injecter une fausse ligne
   `Timestamp: …` dans son propre message et de brouiller l'anti-rejeu.
3. Rate limit serveur : 10 messages / minute / wallet. L'INSERT public n'avait
   aucun garde-fou ; ne pas le retirer en passant.

⚠️ Coût UX assumé : **un popup de signature du wallet à chaque message envoyé**.
C'est lourd pour un chat. L'alternative — signer une fois une « session de
chat » (30 min, token en sessionStorage) et ne plus signer message par message —
reste à faire si la friction se révèle bloquante à l'usage.

⚠️ Toujours ouvert : les autres tables de la même famille (`project_updates`,
`project_messages`, `pact_events`, `role_interests`, `passes`) conservent des
policies d'écriture publiques et le même défaut de fond (colonne wallet non
authentifiée). Le chat a été traité en premier parce qu'il est le plus exposé.

Déploiement : `supabase functions deploy contact --no-verify-jwt`
(le `--no-verify-jwt` est nécessaire : l'authentification se fait par
signature wallet, pas par JWT Supabase — le client n'envoie aucun header
`Authorization`).

**Absent aussi (non bloquant)**

- `src/vite-env.d.ts` — types `import.meta.env`. Trois fichiers l'utilisent
  (`constants.ts`, `supabaseClient.ts`, `translations.ts`) ; le lint passe,
  donc les types Vite sont résolus autrement — à surveiller.
- Docs racine amont : `ACCESSIBILITY.md`, `DESIGN_RATIONALE.md`,
  `SECURITY.md`, `PERFORMANCE.md`, `JUDGES ENG.md`,
  `BUILDPACT-JUDGES-DOCS-EN.html`, les deux PDF d'audit.

**Non vérifiable par listing**

Le contenu de `PactsPage.tsx`, `MarketplacePage.tsx` et `PactPublicPage.tsx`
n'a pas pu être comparé ligne à ligne (le fetch brut tronque). La divergence
de props signalée plus tôt reste donc à confirmer en collant ces trois
fichiers dans le chat.

## IDL — le fichier collé est PLUS ANCIEN que le local, non appliqué (28/08)

Le `buildpact_idl.json` trouvé sous `supabase/functions/open-roles` a été
comparé à `src/idl/buildpact.json`. **Il n'a pas été copié**, pour trois
raisons cumulatives :

1. **Coquille fatale** : sa clé racine est `"instructaions"` et non
   `"instructions"`. Anchor construirait un `Program` sans aucune
   instruction — chaque appel (`createProject`, `fund`, `distribute`…)
   échouerait en « unknown instruction » au moment de signer, jamais au
   build. C'est exactement le genre de panne que ni `tsc` ni le lint ne
   voient.
2. **Version antérieure à l'upgrade du 27-28/08** : il ne déclare que 8
   instructions. Il manque `update_description` (discriminant
   `[192, 56, 16, 166, 212, 219, 112, 142]`) et l'événement
   `DescriptionUpdated`, tous deux présents dans l'IDL local.
3. **Il contredirait `lib/onchainLimits.ts`**, où `PROGRAM_UPGRADED = true`
   documente l'upgrade devnet (signature
   `67Vmcg4F6FgLhDRJRojgahSp3C4SbxU26VsAWANev7cU7gB4So9cXas5s9DbcSdgbTRBSeccXrXWj5uAHNB8ufam`)
   et fait passer les bornes à titre 80 / description 500 / rôle 32.
   `CAN_UPDATE_DESCRIPTION` en dépend, et `MigratePactButton` ne rend rien
   sans lui. Rétrograder l'IDL aurait cassé le bouton de migration tout en
   laissant le front envoyer des descriptions de 500 octets à un IDL qui
   n'expose plus l'instruction correspondante.

Le reste (adresse du programme, les 8 discriminants communs, les 23 codes
d'erreur 6000-6022, les types `Project` / `Member` / `ProjectStatus`) est
identique au champ près. **`src/idl/buildpact.json` est la bonne version,
laissée intacte.**

## Dictionnaires i18n — vérification

Les namespaces `profile`, `builders`, `contact`, `pactCard`, `createWizard` et
`addMember` sont déjà COMPLETS dans `fr.ts` / `en.ts` (vérifié clé par clé
contre le `translations.ts` monolithique récupéré sur GitHub). Le `fr.ts`
local est même plus récent : il contient des clés absentes de l'amont
(`createWizard.wantedRolesLabel`, `descTruncateWarning`, `pactCard.rolesWanted`,
namespaces `editMedia` / `chat` / `vault`…) et a traduit des chaînes restées
en anglais dans le dictionnaire FR amont (`pactCard.claimable`, `vaultBalance`,
`yourShare`, `members`). Ne PAS écraser `fr.ts` avec `translations.ts`.

## Namespace `docs` — corrigé depuis l'amont (22/08)

Le bloc `docs` amont a été recollé dans `fr.ts` : les cinq puces sécurité sont
les vraies (PDA seeds canoniques / signer checks / arithmétique checked /
limite ~8 membres / non audité), et non celles que j'avais inventées. Ajout
aussi des clés `demoKit*` internes à `docs` (doublon assumé avec le namespace
`demoKit`, c'est ainsi dans l'amont). `en.ts` a été aligné sur cette structure
— traduction de ma main, la version EN amont n'a pas été fournie.

<details><summary>Note précédente (obsolète)</summary>

## ⚠️ Namespace `docs` ajouté aux dictionnaires (texte RÉÉCRIT)

`DocsPage` appelle `t('docs.eyebrow')`, `t('docs.stepOf')`, `t('docs.security1')`…
Or le bloc `docs` n'existait PAS dans `fr.ts` / `en.ts` — seul `nav.docs` y
était. Le résolveur ne lève pas d'erreur dans ce cas : il RETOURNE la clé
brute. La page se serait donc affichée avec « docs.eyebrow », « docs.faqHeading »
en clair, sans qu'aucun build ne le signale.

J'ai donc écrit ce bloc dans les deux langues : `eyebrow`, `titleLine1/2`,
`subtitle`, `guideHeading`, `stepOf`, `faqHeading`, `glossaryHeading`,
`instructionsHeading`, `platformHeading`, `platformSubtitle`,
`securityHeading`, `security1..5` et `security1Body..security5Body`.

Ces formulations sont de moi, pas celles du repo amont. À remplacer si le
`fr.ts` / `en.ts` d'origine est retrouvé.

</details>

## Routes dans App.tsx — toutes actives

Plus aucune route désactivée : `#/docs`, `#/profile`, `#/treasury` et
`#/builders` sont de nouveau branchées sur leurs vraies pages. Les liens de
la nav (`DashboardLayout.buildDefaultLinks`) mènent tous quelque part.

## Autres correctifs de la session (à ne pas perdre)

- `src/index.css` — un commentaire contenait une séquence `*/` accidentelle
  qui refermait le bloc en plein milieu ; le reste de la ligne partait au
  parseur de sélecteurs → `[postcss] Unexpected '/'` et écran blanc total.
- `index.html` — ajout des liens Google Fonts (Space Grotesk / Space Mono).
- `tailwind.config.js` — tokens `canvas.DEFAULT`, `ink.500`, `accent-gold`,
  `fontFamily.sans`, keyframe `float`.
- `src/components/wizard/PactStep1.tsx` et `PactStep3.tsx` — signature de la
  prop `t()` alignée sur `useLanguage()` (`Record<string, string | number>`),
  sinon le `t` du contexte n'est pas assignable (strictFunctionTypes).

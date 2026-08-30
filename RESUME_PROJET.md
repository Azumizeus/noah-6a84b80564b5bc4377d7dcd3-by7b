# BuildPact — Résumé complet du projet

> Dernière mise à jour : 30 août 2026 (soir)
> Réseau : **Solana devnet** · Program ID `9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ`

---

## 1. Ce que fait le produit

BuildPact est une plateforme où un porteur de projet (« founder ») formalise
**on-chain** la répartition des parts entre co-fondateurs, avant qu'il y ait
de l'argent à partager. Le contrat crée un `Project` avec des membres, chacun
avec une part en points de base, et un vault qui distribue les entrées de
fonds selon cette répartition.

L'intention produit tient en une phrase : **rendre coûteux de revenir sur sa
parole**. Un accord verbal entre trois personnes qui codent le week-end ne
survit pas au premier chèque ; un compte Solana signé par les trois, si.

Autour de ce noyau on-chain, une couche hors-chaîne (Supabase) porte tout ce
qui n'a pas besoin d'être immuable : profils, médias, chat, candidatures,
journal d'activité, fil social des builders, et une couche de gamification
(XP, rangs, badges, quêtes, classement) ajoutée le 29/08 — voir §5.5.

---

## 2. Découpage on-chain / hors-chaîne

C'est la décision structurante du projet, et elle explique la moitié du code.

| Donnée | Où | Pourquoi |
|---|---|---|
| Membres, parts, approbations | **On-chain** | C'est l'objet du produit. Doit survivre à la disparition du serveur. |
| Vault, distribution | **On-chain** | Manipule des fonds. |
| Titre, description, rôle | **On-chain** | Fait partie de l'accord signé. |
| Logo, bannière, vidéo, à-propos | Supabase | Cosmétique, volumineux, révisable. |
| Profils builders, notes, contacts | Supabase | Social, non contractuel. |
| Chat projet | Supabase | Volume élevé, valeur nulle une fois lu. |
| Rôles recherchés, candidatures | Supabase | Éphémère par nature. |
| Journal d'activité | Supabase | Cache de lecture — la vérité reste la chaîne. |
| Fil social (posts, réactions, commentaires) | Supabase | Social, transversal aux pacts, non contractuel. |
| XP, rangs, badges, quêtes | Supabase (calculé) | Gamification pure ; l'XP dérive de transactions on-chain déjà vérifiées, jamais une source de vérité en soi. |

**Le prix de ce découpage**, à ne pas perdre de vue : tout ce qui est dans la
colonne Supabase est reconstruit à la main pour être digne de confiance. Une
base Postgres ne sait pas qui contrôle une clé Solana. C'est toute la raison
d'être des Edge Functions décrites plus bas.

---

## 3. Programme Anchor (`programs/workspace/src/lib.rs`)

- **Framework** : Anchor 0.31.1
- **Comptes** : `Project` (PDA `["project", creator, id]`), vault PDA `["vault", project]`
- **Contraintes** : `MAX_MEMBERS = 8`, total des parts = `10 000` bps
- **Premier champ de `Project`** : `creator: Pubkey`, juste après les 8 octets
  de discriminant Anchor.

Ce dernier point est **load-bearing** : plusieurs Edge Functions lisent
`creator` en décodant l'octet 8 à 40 du compte, sans Anchor (indisponible en
Deno). Si l'ordre des champs de la struct change, ces fonctions liront une
mauvaise pubkey et refuseront tout — **silencieusement**, sans erreur de
compilation. Le discriminant est vérifié avant lecture, donc un compte d'un
autre type est bien rejeté, mais un réordonnancement de champs ne l'est pas.

Aucune ligne de ce programme n'a été touchée depuis le 27/08. Tout le travail
du 29/08 (thème, réseau, gamification) est **strictement hors-chaîne** :
rien à redéployer pour en bénéficier.

### État de l'IDL et du drapeau `PROGRAM_UPGRADED`

> Une version antérieure de ce document affirmait que
> `src/idl/buildpact.json` ne contenait pas `update_description` et
> qualifiait la situation de bug actif. **C'était une erreur de lecture.**

Vérification faite fichier par fichier, les trois artefacts du dépôt sont
**cohérents entre eux** :

| Artefact | Titre | Description | Rôle | `update_description` |
|---|---|---|---|---|
| `programs/workspace/src/lib.rs` | 80 | 500 | 32 | présente |
| `src/idl/buildpact.json` | — | — | — | présente |
| `src/lib/onchainLimits.ts` (`PROGRAM_UPGRADED = true`) | 80 | 500 | 32 | activée |

L'IDL expose bien les 9 instructions du source, `update_description`
incluse (discriminant `[192,56,16,166,212,219,112,142]`), ainsi que
l'événement `DescriptionUpdated`. Son type `Project` place `creator` en
premier champ, ce qui confirme au passage l'offset 8..40 sur lequel
reposent les Edge Functions.

**Ce que cette cohérence ne prouve pas.** Ces trois fichiers vivent dans le
dépôt. Ils peuvent être parfaitement d'accord entre eux tout en décrivant
un binaire qui n'est pas celui en ligne — le champ `address` d'un IDL est
purement déclaratif, et `PROGRAM_UPGRADED` est un booléen écrit à la main.
Le commentaire de `onchainLimits.ts` mentionne un upgrade le 28/08
(signature `67Vmcg4F6Fg…NB8ufam`), mais un commentaire n'est pas une preuve.

Si le binaire en ligne était en réalité l'ancien, deux symptômes
apparaîtraient : `MigratePactButton` échouerait sur une instruction inconnue
du dispatcher, et surtout l'utilisateur remplirait jusqu'à 500 octets de
description avant de se prendre un `InvalidParameter` (6005) **au moment de
signer** — le pire moment.

Seule la chaîne tranche : `node scripts/idl-check.mjs` sonde le binaire
déployé par simulation, sans clé privée ni transaction. **Exécuté le 29/08
(soir) dans cet espace de travail** : le programme déployé accepte
`update_description` et des descriptions ≥ 400 octets, cohérent avec
`PROGRAM_UPGRADED = true`. Priorité 1 de `FEUILLE_DE_ROUTE.md` est donc
résolue — voir ce document pour le détail de la sortie du script.

---

## 4. Frontend

- **Stack** : React 19, Vite 8, TypeScript 5.5, Tailwind 3.4, framer-motion
- **Routing** : *hash routing* maison (`src/lib/router.ts`), **pas** de
  `BrowserRouter`. Choix assumé pour un déploiement statique sans réécriture
  serveur.
- **Wallet** : `@solana/wallet-adapter` + support Mobile Wallet Adapter
- **i18n** : FR/EN maison (`src/lib/i18n/`), FR par défaut, 773 clés par
  langue, parité vérifiée le 30/08 (soir)
- **Thème** : deux axes CSS indépendants sur `<html>` — `[data-theme]`
  (5 palettes d'accent : violet/cyan/coral/aurum/atelier, la dernière garde
  volontairement l'accent violet mais impose un canevas ivoire/encre quel
  que soit le mode) et `[data-mode]` (clair/sombre, additif, ajouté le
  29/08), plus une échelle d'élévation (`--surface-1/2/3`) et un curseur
  d'intensité de halo (`--glow-strength`, ajoutés le 29/08 nuit). Détail
  complet : `DOSSIER_TECHNIQUE.md` §0.

### Pages

| Route | Fichier | Rôle |
|---|---|---|
| `#/` (déconnecté) | `LandingPage.tsx` | Vitrine |
| `#/` (connecté) | `DashboardPage.tsx` | Mes pacts, création |
| `#/marketplace` | `MarketplacePage.tsx` | Projets ouverts — même bascule de vue que Pacts, préférence partagée (30/08) |
| `#/builders` | `BuildersPage.tsx` | Annuaire des profils |
| `#/network` | `NetworkPage.tsx` (`BuildersNetworkPage.tsx`) | Fil social transversal aux pacts |
| `#/leaderboard` | `LeaderboardPage.tsx` | Classement XP (global ou par pact), panneau perso, journal de quêtes |
| `#/pacts` | `PactsPage.tsx` | Liste étendue — vue liste/grille/vignettes + tri + recherche + pagination (30/08) |
| `#/pact/:pda` | `PactPublicPage.tsx` | Fiche publique partageable (chat + vault) |
| `#/profil` | `MonProfilPage.tsx` | Profil, inbox contact, sessions chat, paramètres (thème/mode/langue) |
| `#/treasury` | `TreasuryPage.tsx` | Vault, distribution, export |
| `#/about`, `#/docs` | `AboutPage`, `DocsPage` | Contenu statique |

`#/network` et `#/leaderboard` ont été ajoutées le 29/08. La seconde a dû
être **reconstruite** en fin de journée après une resynchronisation qui
l'avait fait disparaître du disque avec ses composants (`XpBar`,
`BadgeShelf`, `QuestBoard`) — voir `FEUILLE_DE_ROUTE.md`, section « Fiabilité
du double pipeline Noah / dépôt local ».

---

## 5. Backend Supabase — projet `xkznmflyiilgmxhvgega`

### 5.1 Modèle de sécurité

Le principe, appliqué partout : **aucune table n'accepte d'écriture publique.**
Toute écriture passe par une Edge Function qui prouve l'identité par
signature ed25519, puis écrit avec la clé `service_role`. Le champ « auteur »
est **toujours** renseigné par le serveur à partir du wallet dont la
signature vient d'être vérifiée — jamais depuis un champ envoyé par le client.

C'était loin d'être le cas au départ. L'audit a trouvé des policies
`INSERT with check (true)` sur cinq tables, ce qui permettait à n'importe qui
de poster sous le wallet d'autrui, y compris celui du founder. Ces policies
ont toutes été fermées (voir §5.3).

### 5.2 Edge Functions

| Fonction | Rôle | Preuve exigée |
|---|---|---|
| `chat-moderate` | Chat : post, delete, revoke | Session signée (24 h) / signature unitaire |
| `project-write` | pact_events, updates, candidatures, médias | Vérification on-chain ou signature unitaire |
| `open-roles` | Rôles recherchés | Signature + founder on-chain |
| `update-profile` | Profil builder (dont `banner_url`, `theme_palette`) | Signature |
| `network-write` | Fil social : post / react / comment / delete-post / upload média | Signature ed25519 fraîche, mêmes bornes anti-abus que `project-write` |
| `assistant-chat` | Relais BYOK vers Anthropic / tout fournisseur compatible OpenAI pour l'assistant Nexus — voir §5.6 | Aucune (clé API fournie par l'utilisateur à chaque appel, jamais stockée) |
| `vault` | Lecture vault | — |
| `contact` | Formulaire de contact | — |

Toutes sont déployées avec `verify_jwt: false` : l'authentification est
faite par signature Solana, pas par JWT Supabase (exception : `assistant-chat`,
qui n'a aucune notion d'identité BuildPact — voir §5.6). Il n'y a pas de
comptes utilisateurs au sens Supabase Auth. `network-write` (28/08) puis
`assistant-chat` (29/08 nuit) portent le nombre de fonctions à huit — voir
`FEUILLE_DE_ROUTE.md` Priorité 4, qui en tient compte pour la dette de
tests.

### 5.3 Tables

| Table | Écriture | Lecture |
|---|---|---|
| `project_chat_messages` | `chat-moderate` | publique |
| `chat_session_revocations` | `chat-moderate` (service_role seul) | **aucune** |
| `pact_events` | `project-write` (tx vérifiée on-chain) | publique — alimente aussi l'XP et le Treasury |
| `project_updates` | `project-write` (signature) | publique |
| `role_interests` | `project-write` (signature) | restreinte |
| `project_media` | `project-write` (signature + founder) | publique |
| `project_open_roles` | `open-roles` | publique |
| `builder_profiles` (dont `banner_url`, `theme_palette`) | `update-profile` | publique |
| `builder_contact_requests` | `contact` | restreinte |
| `builder_ratings`, `project_documents` | verrouillées | publique |
| `network_posts`, `network_post_reactions`, `network_post_comments` | `network-write` | publique |
| `xp_events` | `project-write` (action `event`, ledger append-only) | publique (via la vue `wallet_xp`) |

`xp_events` et le fil social ont été ajoutés le 28-29/08 ; aucune des tables
historiques n'a changé de forme, sauf `builder_profiles` qui a gagné deux
colonnes (`banner_url`, `theme_palette`).

### 5.4 Sessions de chat

Signer chaque message était sûr mais imposait un popup wallet par message —
inutilisable. Le compromis retenu : le wallet signe **une fois** un jeton de
session valable 24 h, scopé à **un projet**.

Ce que ça coûte, et qui est assumé : le jeton est un *bearer token* en
`localStorage`. Qui le lit peut publier sous ce wallet. Trois garde-fous
bornent le dégât :

1. **Scope projet** — un jeton volé ne pollue qu'un seul chat.
2. **Rate limit** — 10 messages/minute par wallet.
3. **Révocation serveur** — table `chat_session_revocations`, modèle *cutoff*.

Le modèle cutoff mérite une explication, parce qu'il n'est pas le premier
réflexe. On stocke « toute session signée avant cet instant est refusée »,
pas l'empreinte des jetons révoqués. Raison : celui qui révoque est sur un
**autre appareil** que celui compromis — il n'a pas le jeton à blacklister.
Un cutoff couvre les jetons qu'on ne connaît pas. Bonus : une ligne par
wallet, la table ne grossit jamais.

Deux arbitrages associés, tous deux load-bearing :

- **Tolérance de 60 s** sur le cutoff. Le cutoff est en heure serveur, le
  timestamp de session en heure client. Sans marge, un utilisateur dont la
  pendule retarde re-signe un jeton daté « avant » sa propre révocation :
  rejeté, re-signé, rejeté — popup en boucle sans issue. Le prix : un jeton
  volé signé dans la minute précédant la révocation y survit.
- **Échec fermé** sur la lecture du cutoff. Si la requête échoue, le message
  est refusé (503) plutôt qu'accepté. Traiter la panne comme « pas de
  révocation » ressusciterait des jetons que l'utilisateur croit morts.

À la déconnexion du wallet, `useChatSessionCleanup` efface les jetons locaux.
Ce hook **ne peut pas** révoquer côté serveur : révoquer exige une signature,
et le wallet vient précisément de partir. Limite structurelle, pas un oubli.

### 5.5 Gamification (ajoutée le 29/08, V2 le 29/08 nuit)

Off-chain, purement dérivée de données déjà vérifiées — aucune nouvelle
autorité de confiance introduite :

- **XP** : ledger append-only (`xp_events`), écrit uniquement côté serveur
  dans `project-write` (action `event`) et, depuis la V2, dans `quest-write`
  (réclamation de quête), toujours après vérification d'une transaction
  on-chain réelle ou d'une signature fraîche. La lecture agrège via la vue
  `wallet_xp`.
- **Rangs** : 7 paliers (`rankAnon` → `rankLegendary`), calculés côté client
  à partir du total XP (`computeRank()`), aucune table dédiée.
- **Badges** : 7 badges calculés **à la volée** depuis `pact_events` à
  chaque lecture (pas de table, pas de cache) — les règles peuvent changer
  sans migration. Depuis la V2, la Rangée de badges affiche aussi les
  verrouillés (compteur "7/10") et un % de rareté par badge.
  ⚠️ Bug corrigé le 29/08 (nuit) : la contrainte `pact_events.kind_chk`
  n'acceptait pas le kind `'create'` depuis le début — aucune création de
  pact n'avait jamais compté pour l'XP ni débloqué `serialFounder`/
  `firstMover`. Corrigé, **non rétroactif**.
- **Quêtes hebdomadaires (V2)** : toujours 3 objectifs fixes (financer 2
  pacts, approuver un membre, finaliser un pact), fenêtre UTC lundi 00h
  (remplace l'ancien calcul en heure locale). Récompense désormais
  **réclamée par clic** et revérifiée côté serveur (`quest-write`, même
  schéma de sécurité que `project-write`) plutôt que créditée
  implicitement. Ajouts V2 : série (streak) hebdomadaire, bonus de
  complétion (+150 XP si les 3 sont réclamées la même semaine), onglet
  Chronique (historique lisible des événements on-chain du wallet).
  ⚠️ Bug corrigé le 29/08 (nuit), trouvé lors d'un premier test réel :
  réclamation impossible (« signature invalide ») car `quest-write`
  vérifiait un message sans accents alors que le client signe avec accents
  (« réclamation de quête »/« Quête: »). Les deux côtés matchent désormais
  à l'octet près — détail dans `DOSSIER_TECHNIQUE.md` §12.
- **Classement** : `LeaderboardPage.tsx`, global (`wallet_xp` triée) ou par
  pact (agrégation client sur `xp_events` filtrés par `project_pda`). Le
  journal de quêtes s'ouvre désormais dans un vrai pop-up dédié.

Détail de conception complet : `GAMIFICATION_PLAN.md` (V1) et
`FEUILLE_DE_ROUTE.md` section « 29/08 (nuit) » (V2 + bug kind_chk).

### 5.6 Assistant Nexus — chat Solana/Web3 embarqué, BYOK (ajouté le 29/08 nuit)

Widget de chat flottant, **totalement découplé** du reste de l'app : aucune
autre table/fonction/composant n'en dépend, il ne lit ni n'écrit aucune
donnée du projet. Désactivé par défaut (`VITE_ASSISTANT_ENABLED=false`).

- **BYOK (Bring Your Own Key)**, décision explicite de l'utilisateur :
  BuildPact ne paie ni ne stocke aucune clé API. Chaque utilisateur colle
  la sienne (Anthropic ou tout fournisseur compatible OpenAI) dans les
  réglages du widget ; elle reste dans son `localStorage` uniquement.
- `assistant-chat` (Edge Function) est un relais **sans état** : reçoit la
  clé à chaque appel, la transmet au fournisseur, ne la persiste ni ne la
  journalise jamais.
- **Périmètre légal volontairement restreint** : général/éducatif
  uniquement, jamais de conseil juridique ou financier personnalisé —
  cadré dans le prompt système, avec rappel de portée systématique.
- Conçu pour être réutilisé tel quel par un futur clone mobile Android
  (même Edge Function, seul le wrapper React Native resterait à écrire).

Détail complet : `DOSSIER_TECHNIQUE.md` §14.

### 5.7 Interface — passe qualité/UX (30/08, soir)

Session dédiée aux frictions remontées après usage réel, plus une demande
répétée depuis plusieurs sessions (vue liste/grille) enfin livrée :

- **Vue liste/grille/vignettes** sur `/pacts` et `/marketplace` — nouveau
  `lib/viewMode.ts` + `hooks/useViewMode.ts`, préférence de navigateur
  **partagée** entre les deux pages (même clé localStorage). Mode liste =
  cards détaillées existantes inchangées (actions on-chain incluses) ;
  grille/vignettes = nouveau `components/PactTile.tsx` (léger, lien simple
  vers la fiche) + tri (défaut/récents/nom/statut) + recherche (nom ou
  rôle recherché) + pagination (12/30/60 par page).
- **Soldes multi-tokens du wallet, lecture seule** — `lib/
  tokenBalances.ts` liste tous les SPL détenus (USDC devnet reconnu par
  mint officiel, SKR/SKG dynamiques via env une fois déployés, autres
  tokens affichés génériques). Le **paiement** avec ces tokens n'est pas
  couvert — nécessiterait de nouvelles instructions Anchor, en attente
  d'un GO explicite ; c'est NOAH qui gère les évolutions du Program ID.
- **Journal de quêtes V3 (suite)** : icônes pleines dédiées aux badges
  (`IconFundFilled`/`IconApproveFilled`/`IconFinalizeFilled`) + flash
  "déblocage" au moment précis où une quête devient réclamable.
- **XpBar animée** : compteur XP qui défile (au lieu de sauter), reflet
  en boucle sur la barre, flash + éclat au changement de rang — les trois
  neutralisés sous `prefers-reduced-motion` comme le reste des animations
  d'ambiance de l'app.
- **Bug hydratation corrigé** : `BuildersPage.tsx` imbriquait un
  `<StarRating>` (qui rend des `<button>`) dans un `<button>` englobant —
  HTML invalide. Carte cliquable passée en `<div role="button">`.
- **`InfoTooltip` réécrit en portail `fixed`** : n'est plus coupé dans un
  panneau `overflow-y-auto`, et ne se referme plus instantanément au
  survol (délai 250ms, la bulle capte elle-même le survol).
- **"?" redondants retirés** partout où le texte explicatif est déjà
  affiché en permanence à côté (CsvExportButton, NotificationSettings,
  CustomRpcSettings, DensitySwitch, palette d'accent, confidentialité).
- **Panneau des réglages en plein écran** (`ProfileSettingsModal.tsx`) —
  avant : boîte centrée `max-w-xl` avec la page visible tout autour.
- **Aperçu grand format (logo/bannière)** : déclenchement au clic
  uniquement, le survol a été retiré (gênait sur une grille dense).

Détail complet, y compris les vérifications live : mémoire de session
[[buildpact_view_modes_wallet_tokens_300826]] et
[[buildpact_settings_ux_and_xpbar_polish_300826]].

---

## 6. Clés et artefacts

| Fichier | Contenu | Statut |
|---|---|---|
| `contracts/target/wallet/wallet.json` | Autorité d'upgrade (devnet) | présent, **pubkey confirmée correcte le 29/08 nuit** (4e vérification, cette fois validée aussi contre `~/.config/solana/id.json`, le fichier réellement utilisé par Anchor) |
| `contracts/target/wallet/id.json` | Copie du précédent, nom attendu par Anchor | présent |
| `contracts/target/idl/workspace.json` | Copie de l'IDL | présent |
| `src/idl/buildpact.json` | IDL utilisé par le frontend | présent |
| `contracts/target/deploy/workspace-keypair.json` | Keypair du **programme** | **absent** |

Sur le keypair du programme, autant être direct : il est absent et
**irrécupérable** — une clé privée ne se déduit pas d'une adresse publique.
La bonne nouvelle est qu'il n'est **pas nécessaire** : il ne sert qu'au
premier déploiement, qui a déjà eu lieu. Les upgrades ultérieurs
n'engagent que l'autorité d'upgrade, présente dans `wallet.json`.

Le seul scénario qui casserait est un redéploiement *à la même adresse* après
suppression du programme. Il n'est pas atteignable ici.

**Historique à connaître avant de se fier à « c'est corrigé »** : cette clé a
été signalée corrigée trois fois lors de sessions précédentes et s'est
retrouvée fausse à nouveau à chaque fois, vraisemblablement à cause d'une
resynchronisation Noah qui réécrit `wallet.json` avec un état antérieur.
Avant tout `anchor upgrade` réel, revérifier les deux commandes : `node
scripts/keys-check.mjs` **et** `solana address -k ~/.config/solana/id.json`
(ce second fichier, celui qu'Anchor utilise vraiment via `[provider] wallet`
dans `Anchor.toml`, n'est pas couvert par le script).

`scripts/keys-check.mjs` dérive les pubkeys des keypairs présents et les
compare à `Anchor.toml` et à `PROGRAM_ID`, pour vérifier la cohérence sans
avoir à faire confiance à un commentaire.

> ⚠️ `wallet.json` est une **clé privée en clair, versionnée**. C'est
> acceptable pour du devnet et seulement pour ça. Avant tout passage en
> mainnet, cette clé doit être sortie du dépôt et considérée comme brûlée.

---

## 7. Configuration

`.env` (les variables `VITE_*` sont **publiques**, elles finissent dans le
bundle — ne jamais y mettre de `service_role`) :

```
VITE_SOLANA_RPC_URL=...
VITE_PROGRAM_ID=9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ
VITE_SUPABASE_URL=https://xkznmflyiilgmxhvgega.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Un scan de sécurité automatisé (Noah, 29/08) signale `VITE_SUPABASE_ANON_KEY`
comme « JWT codé en dur » dans le bundle buildé. C'est le fonctionnement
normal de Vite (toute variable `VITE_*` est inlinée dans le JS livré au
navigateur), pas une fuite : la clé anon est conçue pour être publique, la
sécurité vient des policies RLS, jamais du secret de cette valeur. Détail :
`DOSSIER_TECHNIQUE.md` §12.

Les deux variables Supabase manquaient à un moment ; elles sont désormais
présentes dans `.env`. La conséquence de leur absence n'était pas une erreur
mais un silence : `isRemoteEnabled` retombait à `false` et **toute** la
couche Supabase se désactivait — profils vides, chat absent, activité
muette, sans le moindre message.

⚠️ Vite ne lit `.env` **qu'au démarrage**. Après toute modification, il faut
arrêter et relancer `npm run dev` — un rechargement du navigateur ne suffit
pas, et c'est la cause n°1 de « j'ai pourtant mis la variable ».

En production (Vercel ou équivalent), `.env` n'est pas déployé : les mêmes
variables doivent être saisies dans les réglages du projet, puis un nouveau
build déclenché.

---

## 8. Ce qui reste ouvert

- **Bucket de stockage (médias de projet)** : les fichiers médias sont
  poussés directement avec la clé anon. La table `project_media` est
  protégée, le bucket ne l'est pas encore — on peut écraser `<pda>/logo.png`.
  Correctif : policies sur `storage.objects` restreignant l'écriture, ou
  upload via Edge Function. Le bucket du fil social (`network-media`) est
  couvert séparément par `network-write`, action `post-media-upload-url` —
  ne pas confondre les deux chantiers.
- **Décalage IDL / programme** — voir §3.
- **Membership non vérifiée** sur `project_updates` : la signature prouve le
  wallet, pas l'appartenance au projet. L'auteur affiché est donc toujours
  exact, mais un tiers peut publier une update sous son propre nom.
- **Pas de tests d'intégration** sur les Edge Functions (sept désormais).
- **Financement multi-token** (USDC/USDT/BTC/ETH) : spec écrite
  (`MULTI_TOKEN_FUNDING_PLAN.md`), aucune ligne de programme écrite. La
  **lecture** des soldes (USDC/SKR-SKG/autres SPL détenus) est livrée
  depuis le 30/08 (§5.7) — c'est le **paiement** qui reste ouvert, et qui
  demande le chantier Anchor décrit dans la spec.

Détail et priorisation : `FEUILLE_DE_ROUTE.md`.

---

## 9. Session 30/08 (nuit, suite) — icônes, fonds, providers Nexus, financement multi-token

**Icônes système** : les derniers emoji du site (👑🔒🤝🔧🔗📩) remplacés par
des SVG `currentColor` faits main (style Duolingo, traits épais arrondis),
répartis sur `MiscIcons.tsx`/`RankIcons.tsx`, câblés dans 9 fichiers
(`DocsPage`, `ProjectCard`, `ActivityFeed`, `BuilderDetailModal`,
`PactCard`, `OrbitalCapTable`...).

**2 fonds HD supplémentaires** (`constellation_hd`, `wave_hd`, images Grok
recadrées) ajoutés aux réglages — 10 fonds au total. 2 bannières prêtes
(`pact-generic.jpg`, `profile-network.jpg`) mais **pas encore câblées** :
aucun sélecteur de bannière n'existe côté UI pour l'instant.

**Fournisseurs Nexus** : NVIDIA NIM et GoRouter confirmés compatibles
OpenAI (`/v1/chat/completions` + Bearer) et ajoutés comme boutons raccourci
dans le panneau réglages de `AssistantChat.tsx` — zéro code serveur
nouveau, le mécanisme `callOpenAiCompatible` existant les couvre. OmniRoute
reporté (exposition publique voulue par l'utilisateur, mais "plus tard").
opencode.ai et mammouth.ai toujours sans verdict clair.

**Bug FreeGrid (dashboard profil) corrigé en 2 passes** : le premier
correctif (lire `layouts.lg` au lieu du `layout` courant, pour éviter
qu'un breakpoint mobile écrase le layout desktop) a cassé le glissé en
direct — `layouts.lg` ne se met à jour qu'À LA FIN d'un geste chez
react-grid-layout. Fix définitif : toujours utiliser le `layout` courant
pour l'affichage (glissé fluide), ne persister en localStorage que quand
`onBreakpointChange` rapporte `'lg'`.

**Pop-up réglages, plein écran total** (2e passe) : plus aucune contrainte
`sm:` — le panneau couvre 100% largeur/hauteur sur tous les écrans, plus de
boîte centrée. Wallet : soldes multi-tokens désormais toujours affichés
avec un message explicite si le wallet n'en détient aucun (cas normal sur
devnet), au lieu de ne rien montrer.

### Financement multi-token — code écrit, PAS compilé, PAS déployé

GO explicite de l'utilisateur sur `MULTI_TOKEN_FUNDING_PLAN.md` : Option B
(plusieurs vaults simultanés par mint) et séquencement USDC → USDT →
BTC/ETH pontés.

`programs/workspace/src/lib.rs` (816 → 1083 lignes) reçoit deux nouvelles
instructions :

- `fund_spl(amount)` — `transfer_checked` (jamais `transfer` nu) vers un
  vault PDA-par-mint (`["token_vault", project, mint]`) qui est lui-même
  son propre compte-jeton (`token::authority = token_vault`). Même
  garde-fou que `fund` : uniquement après finalisation.
- `distribute_spl()` — même arithmétique bps checked (frais 2% + parts)
  que `distribute`, appliquée à `token_vault.amount`. Chaque compte-jeton
  membre passé en `remaining_accounts` est désérialisé et vérifié (mint +
  propriétaire) avant tout virement.

Nouveaux comptes `FundSpl`/`DistributeSpl`, nouveaux events
`ProjectFundedSpl`/`FundsDistributedSpl`, nouvelle erreur `InvalidMint`
ajoutée EN FIN d'enum (6023) — règle d'or respectée. `anchor-spl` était
déjà dans `Cargo.toml` (jamais importée jusqu'ici) : aucun changement de
manifeste nécessaire. Program ID / Config PDA non touchés.

⚠️ **Aucun outil Rust/Anchor disponible dans le sandbox Cowork** — le code
a été relu à l'œil (structure, conventions, accolades) mais jamais passé
par `cargo check`/`anchor build`. Avant tout déploiement :
1. Build local pour attraper les erreurs de compilation.
2. **Mint USDT devnet à confirmer** — l'utilisateur a communiqué
   `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, qui est EXACTEMENT le
   mint déjà documenté comme USDC dans `tokenBalances.ts` (`KNOWN_MINTS`).
   Vraisemblablement une erreur de copier-coller — ce fichier note
   explicitement qu'aucun mint USDT officiel n'existe sur devnet. À
   reconfirmer avant d'écrire la moindre constante USDT côté frontend.
3. Tests LiteSVM avant toute confiance dans ce code (convention "28/28
   tests" du projet).
4. Aucun déploiement/upgrade prévu sans confirmation séparée explicite.

### Chantiers ouverts, scoping en cours

- **Chat entre builders** (nouveau, distinct du chat par-pact existant) —
  voir `BUILDER_CHAT_PLAN.md`.
- **Console admin/dev cachée** (logs, modération, ban, don d'XP manuel,
  détection d'erreurs) — voir `ADMIN_CONSOLE_PLAN.md`. Chantier sensible
  (contrôle d'accès, RLS, audit trail) : aucun code écrit avant validation
  du modèle proposé.
- **Images pour les pop-ups de l'app** (réglages, journal de quêtes...) —
  confirmé par l'utilisateur, liste précise des pop-ups à couvrir pas
  encore arrêtée.
- **2FA** — voir `ADMIN_CONSOLE_PLAN.md` §5 (pertinent surtout pour les
  comptes admin/dev, l'app grand public s'authentifie par signature
  wallet, pas par mot de passe).

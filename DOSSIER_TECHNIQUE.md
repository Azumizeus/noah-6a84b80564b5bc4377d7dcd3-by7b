# BuildPact — Dossier technique

> Dernière mise à jour : 30 août 2026 (soir)
> Public visé : développeur qui reprend le code. On y trouve les décisions
> d'architecture et leurs contreparties, pas un catalogue de fonctions.

---

## 0. Design system — thème d'accent et mode clair/sombre

Les couleurs de marque ne sont plus des littéraux. Trois variables CSS
portent la triade d'accent, définies dans `src/index.css` et sélectionnées
par un attribut `data-theme` sur `<html>` :

| Variable | Rôle | Exemples d'usage |
|---|---|---|
| `--accent-violet-rgb` | primaire | navigation active, bordures, CTA |
| `--accent-neon-rgb` | argent | fund, distribute, claim |
| `--accent-gold-rgb` | mise en avant | badges, chiffres clés |

### `.modal-surface` vs `.glass-panel` — ne pas confondre (29/08 nuit)

`.glass-panel` (fond ~5% d'alpha) est pensé pour des **cartes posées sur
le fond décoré de la page** (orbes, grille, aurora…) — sur un fond
`solid` ou en mode clair, ce même fond quasi transparent devient
illisible. `.modal-surface` (nouveau, `background-color:
rgb(var(--canvas-800-rgb) / 1)`, opaque) est la classe à utiliser pour
toute **pop-up/modale** (`ProfileSettingsModal`, `AssistantChat`…). Bug
réel corrigé le 29/08 : plusieurs modales utilisaient encore
`.glass-panel` et devenaient transparentes/illisibles sur fond clair ou
`solid`.

### Aperçu avant validation — `ThemeContext.preview` (29/08 nuit)

Le sélecteur de thème/mode/fond appliquait le changement instantanément
au clic, sans retour arrière possible. Ajout d'un état `preview:
{theme?, mode?, background?} | null` dans `ThemeContext` : un clic sur
une option appelle `previewSet(...)` (applique visuellement, ne
persiste pas), un bandeau de confirmation apparaît, et seul un clic sur
« Activer » (`confirmPreview()`) commit réellement (et persiste comme
avant) — « Annuler » (`cancelPreview()`) revient à l'état précédent.
**Piège pour tout futur consommateur de `background`/`theme`/`mode`** :
lire directement la valeur committée ignore l'aperçu en cours. Il faut
calculer `preview?.x ?? x` (voir `DashboardLayout.tsx`), sans quoi le
fond affiché ne bouge pas pendant l'aperçu.

Les mini-visualiseurs (`ThemeModeGrid.tsx`, `BackgroundSwitch.tsx`) ont
aussi été refaits ce soir-là pour approximer visuellement chaque style
(orbes, grille, aurora, scanlines…) plutôt qu'un simple emoji dans un
rond de couleur.

Les **noms sont des rôles, pas des couleurs** : sous la palette `cyan` ou
`coral`, `--accent-violet-rgb` vaut une autre teinte. Les renommer aurait
imposé de toucher chaque classe Tailwind du projet, pour un gain purement
cosmétique.

### Le piège à connaître avant de toucher à ça

Les variables contiennent des **canaux RGB séparés** (`153 69 255`), jamais
un hex ni un `rgb(...)` complet. C'est imposé par `tailwind.config.js`, qui
déclare :

```js
"accent-violet": "rgb(var(--accent-violet-rgb) / <alpha-value>)"
```

C'est ce qui permet à `bg-accent-violet/20` de fonctionner. Mettre un hex
dans la variable produirait `rgb(#9945FF / 0.2)` — invalide. Tailwind
n'échouerait pas : la déclaration serait simplement ignorée et l'élément
rendrait **transparent**, sans erreur de build ni avertissement. Une
régression de ce type ne se voit qu'à l'œil, page par page.

Même logique en CSS pur : on écrit `rgb(var(--accent-violet-rgb) / 0.35)`,
jamais `rgba(153, 69, 255, 0.35)` — sinon l'élément reste violet quel que
soit le thème. C'est le cas des orbes de fond, de `grid-bg`, des ombres de
`.card-lift` et des dégradés de boutons, tous convertis.

### Persistance

`src/lib/theme.ts` mémorise le choix sous deux clés : une par wallet et une
globale. La clé globale n'est pas redondante — le thème doit s'appliquer
avant toute connexion (la landing s'affiche sans wallet), sinon chaque
chargement démarrerait sur la palette par défaut puis basculerait, produisant
un flash de couleur visible.

`ThemeProvider` doit être monté **à l'intérieur** du `WalletProvider` : il
lit `useWallet()`. Au-dessus, il plante au rendu.

La synchronisation multi-appareils passe par la colonne `theme_palette` sur
`builder_profiles`, validée côté serveur par `update-profile` — branchée
depuis `ProfileSettingsModal` (voir §12).

### Mode clair/sombre (ajouté le 29/08) — un second axe, indépendant

`[data-mode]` sur `<html>` choisit clair ou sombre, **indépendamment** de
`[data-theme]`. Les deux se combinent librement : n'importe quelle palette
d'accent avec n'importe quel mode. `:root` reste le mode sombre historique
(pas d'attribut posé pour `'dark'`, même logique que la palette par défaut) ;
`[data-mode='light']` réécrit les variables `--canvas-*-rgb` (fonds) et
`--ink-*-rgb` (textes muets) définies dans `tailwind.config.js`.

**Le piège rencontré en le construisant**, parce qu'il aurait pu passer une
revue rapide sans être vu : le texte par défaut de `body` a d'abord été
branché sur `--ink-900-rgb`, une variable déjà existante et nommée « le ton
d'ink le plus sombre ». Sauf que cette variable est **délibérément la même
teinte quasi-noire dans les deux modes** — elle sert de texte d'emphase sur
un fond déjà clair (une card, par exemple), pas de texte principal de page.
L'utiliser pour `body` aurait rendu tout le texte par défaut illisible en
mode sombre : noir sur fond quasi-noir.

Corrigé par l'introduction d'une variable dédiée, `--text-primary-rgb`
(blanc en sombre, quasi-noir en clair), qui porte à la fois :

- le `color` du `body` ;
- un override ciblé, `[data-mode='light'] .text-white { color: rgb(var(--text-primary-rgb)); }`.

Ce second point existe parce que **Tailwind ne traite pas `white`/`black`
comme des variables** — ce sont des littéraux hex compilés en dur dans le
CSS généré. `text-white`, utilisé abondamment pour les titres et le texte à
forte emphase, ne peut donc pas se reteinter via le mécanisme de variables :
il faut une règle CSS scoped qui le surcharge explicitement sous
`[data-mode='light']`, plutôt que de refactorer chaque usage de `text-white`
dans le projet.

**Assumé, pas oublié :** les glows, les orbes de fond et `grid-bg` restent
calés sur le rendu sombre dans les deux modes. Les retravailler pour le mode
clair aurait multiplié la surface touchée pour un bénéfice visuel
secondaire — le mode clair change le fond et le texte, pas l'identité
visuelle néon du produit.

### Élévation, glow-strength, Aurum et Atelier (ajoutés le 29/08 nuit)

Deux tokens dérivés de plus dans `:root` :

- `--surface-1/2/3-rgb`, **aliasés sur `--accent-violet-rgb`** — une
  variable CSS peut référencer une autre variable CSS, donc ces trois
  niveaux se reteintent automatiquement avec la palette active sans qu'il
  faille dupliquer une valeur par palette. `.glass-panel` consomme
  `--surface-1-rgb` ; deux classes utilitaires `.surface-2`/`.surface-3`
  couvrent les cas où un panneau doit se détacher d'un `.glass-panel`
  parent.
- `--glow-strength` (0 à 1, continu) — posée en JS via
  `style.setProperty`, PAS un attribut `data-*` comme le thème/mode : elle
  est multipliée dans des `calc()` à l'intérieur de canaux alpha existants
  (`rgb(var(--accent-violet-rgb) / calc(0.55 * var(--glow-strength)))`)
  plutôt que sélectionnée par bloc. 3 crans exposés en UI (0/0.5/1) mais la
  variable accepte n'importe quelle valeur.

Deux palettes de plus dans `[data-theme]`, avec un statut différent des
trois premières :

- **Aurum** — vraie nouvelle teinte d'accent (or, `#E8B84B`), et un
  canevas noir chaud (`#0B0A08`) qui remplace le canevas sombre standard
  **uniquement en mode sombre** (règle `[data-theme='aurum']:not([data-mode='light'])`,
  spécificité 0,2,0, gagne sur `:root` sans dépendre de l'ordre des règles).
- **Atelier** — l'inverse : **aucune nouvelle teinte d'accent** (garde
  `--accent-violet-rgb` standard, « accent conservé »), toute sa
  distinction vient d'un canevas ivoire (`#F7F4EE`) / encre (`#1A1814`)
  **appliqué quel que soit `[data-mode]`** — c'est le seul thème pensé
  pour rester visuellement clair même quand le reste de l'app est basculé
  en mode sombre. Techniquement obtenu par une règle `[data-theme='atelier']`
  placée délibérément APRÈS le bloc `[data-mode='light']` dans le fichier :
  à spécificité égale (0,1,0 chacune), c'est la dernière règle du fichier
  qui l'emporte, donc Atelier bat aussi le mode clair standard. Un second
  override cible `.text-white` pour la même raison que le mode clair (voir
  plus haut) : sans lui, les titres resteraient blancs sur fond ivoire tant
  que `[data-mode]` vaut encore `dark`.

`ThemeModeGrid.tsx` (le sélecteur combiné palette×mode de `ProfileSettingsModal`)
passe donc de 6 à 10 boutons.

---

## 1. Architecture générale

```
Navigateur (React 19 + Vite)
  ├── @solana/wallet-adapter ──► Programme Anchor (devnet)
  │                              9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ
  │
  └── fetch ──► Edge Functions Deno (Supabase)
                  │  vérifient une signature ed25519
                  │  ou une transaction on-chain
                  └──► Postgres (service_role, RLS contournée)

Lecture directe : navigateur ──► Postgres (clé anon, SELECT public)
```

Le point à retenir : **la lecture est directe, l'écriture ne l'est jamais.**
Le client Supabase du frontend n'a plus aucun droit d'écriture sur les tables
métier.

---

## 2. Le problème central : Postgres ne connaît pas Solana

Toute la complexité backend découle d'un fait unique. Une policy RLS peut
tester `auth.uid()`, mais il n'existe pas de compte Supabase ici — l'identité
est une clé publique Solana. Postgres n'a aucun moyen de vérifier qu'un
appelant contrôle cette clé.

Conséquence : une policy `INSERT with check (true)` sur une table contenant
une colonne `author_wallet` remplie par le client est équivalente à *aucune
authentification du tout*. C'était l'état initial de cinq tables.

Trois réponses possibles, toutes utilisées selon le cas :

| Preuve | Coût pour l'utilisateur | Utilisée pour |
|---|---|---|
| Signature ed25519 unitaire | 1 popup wallet | Actes rares et délibérés |
| Jeton de session signé (24 h) | 1 popup / 24 h | Chat (volume élevé) |
| Vérification de transaction on-chain | 0 popup | Journal d'activité, XP |

La troisième est la plus forte des trois : elle prouve l'**acte**, pas
seulement l'identité. Elle n'est applicable que lorsqu'une transaction existe
déjà, ce qui est précisément le cas du journal et de l'attribution d'XP.

---

## 3. Format des messages signés

Tous les messages suivent la même forme :

```
BuildPact — <action>
Wallet: <base58>
Projet: <base58>        ← absent pour la révocation, qui est wallet-large
Timestamp: <ms epoch>
```

Ils sont validés côté serveur par des **regex ancrées** (`^…$`), jamais par
`includes`.

C'est load-bearing et ça mérite d'être compris : les formats se ressemblent
beaucoup. Avec une correspondance partielle, une signature obtenue pour une
candidature pourrait être présentée comme une autorisation de modifier les
médias d'un projet. L'ancrage rend les formats mutuellement inacceptables.

**Corollaire pratique :** modifier un de ces libellés côté client — un
espace, un accent, l'ordre des lignes — casse l'action correspondante. Le
symptôme est un « Message de signature invalide » qui ne dit pas lequel des
deux côtés a bougé. Les constructeurs sont centralisés dans
`src/lib/projectWrite.ts` pour limiter le risque. Le fil social suit le même
gabarit dans `network-write` (« BuildPact — réseau builders »), signature
fraîche à chaque action, pas de session longue durée comme pour le chat.

Fenêtre de fraîcheur : 5 minutes, avec 60 secondes de tolérance pour les
horloges en avance. Sans cette tolérance, un poste légèrement désynchronisé
verrait toutes ses signatures refusées.

---

## 4. Sessions de chat

### Le compromis

Signer chaque message est le comportement sûr. C'est aussi un popup wallet
par message, ce qui rend un chat inutilisable — et le contournement évident
serait de retirer la sécurité, pas d'endurer les popups.

Le wallet signe donc **une fois** un jeton valable 24 h, scopé à **un
projet**, stocké en `localStorage`.

### Ce que ça coûte, explicitement

C'est un *bearer token*. Qui le lit (XSS, extension, poste partagé) peut
publier sous ce wallet jusqu'à expiration. Il n'y a pas d'échappatoire à ça :
c'est la contrepartie exacte du confort gagné. Trois garde-fous bornent le
dégât sans le supprimer :

1. **Scope projet** — un jeton volé ne pollue qu'un chat.
2. **Rate limit** — 10 messages/minute par wallet.
3. **Révocation serveur** — le seul moyen de tuer un jeton déjà sorti.

### Le modèle *cutoff*

`chat_session_revocations` stocke, par wallet, une date : *toute session
signée avant cet instant est refusée*. Pas une liste de jetons révoqués.

Ce n'est pas le premier réflexe, et la raison mérite d'être écrite : pour
blacklister un jeton, il faut le connaître. Or celui qui révoque est sur un
**autre appareil** que celui compromis — il n'a pas le jeton sous la main.
Un cutoff couvre les jetons inconnus, ce qui est exactement le cas d'usage.
Effet de bord bienvenu : une ligne par wallet, la table ne grossit jamais.

Deux détails load-bearing :

- **Tolérance de 60 s sur le cutoff.** Le cutoff est en heure serveur, le
  timestamp de session en heure client. Sans marge, un utilisateur dont la
  pendule retarde re-signe un jeton daté « avant » sa propre révocation :
  rejeté, re-signé, rejeté. Popup en boucle, sans issue possible pour lui.
  Le prix accepté : un jeton volé signé dans la minute précédant la
  révocation y survit.
- **Échec fermé sur la lecture du cutoff.** Si la requête échoue, le message
  est refusé (503). Traiter la panne comme « pas de révocation »
  ressusciterait silencieusement des jetons que l'utilisateur croit morts —
  soit exactement le scénario que le dispositif existe pour fermer.

### Trois niveaux, à ne pas confondre

| Action | Portée | Effet serveur |
|---|---|---|
| `clearChatSession` | 1 projet, ce navigateur | aucun |
| `clearChatSessionsForWallet` | tous projets, ce navigateur | aucun |
| `revokeChatSessions` | tous projets, **tous appareils** | cutoff posé |

La déconnexion du wallet déclenche le niveau 2 (`useChatSessionCleanup`).
Elle **ne peut pas** déclencher le niveau 3 : révoquer exige une signature,
et le wallet vient précisément de se déconnecter. Limite structurelle.

### Le panneau du profil

`ChatSessionsPanel` liste les jetons du navigateur courant. Cette liste
n'est **pas** un inventaire des sessions actives — le serveur ne tient aucun
registre des jetons émis. Une session ouverte sur un téléphone n'y figure
pas.

L'avertissement affiché sous la liste n'est pas décoratif : sans lui,
l'écran se lit comme un inventaire complet et donne un faux sentiment de
sécurité. Le bouton de révocation, lui, agit bien partout — l'écart entre les
deux est la principale source de confusion possible sur cet écran.

---

## 5. Journal d'activité : preuve par la transaction

`logPactEvent` s'exécute juste après une transaction confirmée. Exiger une
signature y ajouterait un **second** popup immédiatement après celui de la
transaction — insupportable en usage réel.

L'Edge Function vérifie donc la transaction elle-même. Quatre conditions,
chacune fermant un abus précis :

1. La transaction existe on-chain → interdit d'inventer une signature.
2. Elle a réussi (`err === null`) → une transaction échouée ne finance rien ;
   la journaliser afficherait un versement qui n'a pas eu lieu.
3. Elle invoque **notre** programme → interdit de recycler un transfert SOL
   quelconque comme preuve.
4. `actor` en est signataire → interdit d'attribuer la transaction d'un
   autre.

Deux protections complètent le dispositif :

- **Contrainte `UNIQUE` sur `tx_sig`** — la vérification prouve qu'une
  transaction a eu lieu, pas qu'elle n'est pas rejouée cinquante fois pour
  gonfler le fil. Le doublon (code `23505`) est traité comme un succès
  idempotent côté fonction.
- **Réessai unique sur `tx_not_found`** (HTTP 409, 2,5 s) — l'appel suit la
  confirmation de près et le nœud RPC interrogé peut avoir une seconde de
  retard d'indexation. Sans réessai, des événements réels disparaîtraient du
  fil pour une simple course entre nœuds. Un refus 403, lui, n'est jamais
  réessayé : il signifie que la transaction ne prouve pas l'événement, ce
  qu'un réessai ne changera pas.

La même vérification de transaction sert de porte d'entrée à l'attribution
d'XP (action `event` de `project-write`, voir §12) : aucun mécanisme
supplémentaire, l'écriture de `pact_events` et celle de `xp_events` sont
gardées par la même preuve.

---

## 6. Médias : une signature, pas quatre

`EditMediaModal` peut modifier logo, bannière, vidéo et texte de présentation
en une fois. Si chaque champ déclenchait son propre appel signé, une
sauvegarde coûterait jusqu'à quatre popups d'affilée.

D'où le découpage en deux temps dans `src/lib/media.ts` :

1. `uploadMediaFile()` — pousse le binaire vers le bucket. Aucune signature.
2. `saveProjectMedia()` — écrit tous les champs en **un** appel signé.

L'ordre est délibéré : si l'utilisateur refuse le popup, on laisse un fichier
orphelin dans le bucket (sans coût réel, écrasé au prochain essai) plutôt
qu'une signature consommée pour un enregistrement qui échoue ensuite.

Convention de l'API : **champ absent = inchangé**, **chaîne vide = effacement
explicite**. Le serveur construit la mise à jour par liste blanche de
colonnes — un `upsert` bâti sur l'objet client permettrait d'écrire des
colonnes non prévues.

`saveProjectMedia` est aussi la seule action à vérifier le **founder**
on-chain, en plus de la signature. Une signature prouve l'identité, pas
l'autorisation : sans ce contrôle, n'importe qui signerait son propre message
pour remplacer la bannière d'un projet tiers.

`ProfileSettingsModal` (§12) suit la convention inverse quand elle n'a pas
de brouillon de page hôte à disposition : elle relit le profil distant juste
avant d'écrire plutôt que de faire confiance à un objet partiel — pour ne
jamais reproduire le bug de perte silencieuse décrit ci-dessous.

---

## 7. Décodage on-chain sans Anchor

Les Edge Functions tournent en Deno, où Anchor n'est pas disponible. Elles
lisent `Project.creator` en brut :

```
[0..8]   discriminant Anchor  → vérifié avant toute lecture
[8..40]  creator: Pubkey      → premier champ de la struct
```

Le discriminant est contrôlé, donc un compte d'un autre type est bien
rejeté. **Mais un réordonnancement des champs de `Project` dans `lib.rs` ne
l'est pas** : la fonction lirait 32 octets au mauvais endroit, obtiendrait
une pubkey arbitraire, et refuserait toutes les écritures — sans erreur de
compilation, sans log explicite, avec un simple « seul le founder peut… »
adressé au founder légitime.

Si l'ordre des champs doit changer, ces fonctions doivent être mises à jour
dans le même mouvement : `chat-moderate`, `project-write`, `open-roles`.

Cette lecture reste possible parce que `creator` est le **premier** champ.
Un champ plus loin dans la struct ne serait pas à offset fixe : Borsh
sérialise les `String` en `[4 octets de longueur][octets]`, donc tout ce qui
suit une chaîne se décale.

---

## 8. Contraintes du programme

| Constante | Valeur | Pourquoi cette valeur |
|---|---|---|
| `MAX_MEMBERS` | 8 | Chaque membre ajoute un CPI `transfer` dans `distribute` |
| `TOTAL_BPS` | 10 000 | Somme des parts, invariant vérifié on-chain |
| `MAX_PROJECT_ID_LEN` | 20 | Sert de seed PDA — plafond Solana à 32 octets |
| `MAX_TITLE_LEN` | 80 | Après upgrade (40 avant) |
| `MAX_DESC_LEN` | 500 | Après upgrade (280 avant) |
| `MAX_ROLE_LEN` | 32 | Après upgrade (24 avant) |
| `PROTOCOL_FEE_BPS` | 200 | 2 %, wallet destinataire figé on-chain |
| `DUST_TOLERANCE_LAMPORTS` | 1 000 | Permet de fermer un pact distribué à la poussière près |

Deux pièges récurrents :

- **Ce sont des OCTETS UTF-8, pas des caractères.** Un « é » en vaut 2, un
  emoji jusqu'à 4. Un compteur basé sur `String.length` annonce une capacité
  qui n'existe pas, et l'utilisateur découvre le problème au moment de
  signer. Utiliser `utf8ByteLength()` de `src/lib/textSafety.ts`.
- **Le vrai plafond est la taille de transaction**, pas le rent. Une
  transaction Solana est limitée à 1232 octets tout compris. Sur
  `create_project`, il reste de l'ordre de 900 octets utiles. Toute borne
  au-delà de ~800 est de l'espace payé mais physiquement inatteignable.

`src/lib/onchainLimits.ts` reflète ces valeurs côté frontend via le drapeau
`PROGRAM_UPGRADED`.

> **Mise à jour du 29/08 :** une version antérieure de cette section
> affirmait ce drapeau « actuellement incohérent avec l'IDL ». Vérification
> fichier par fichier faite depuis (voir `RESUME_PROJET.md` §3) : les trois
> artefacts du dépôt (`lib.rs`, l'IDL, `onchainLimits.ts`) sont en réalité
> **cohérents entre eux**. Ce qui reste vrai, et qui est la nuance
> importante : cette cohérence ne prouve pas que le binaire **déployé** sur
> devnet corresponde à ce que ces trois fichiers décrivent — voir
> `FEUILLE_DE_ROUTE.md`, Priorité 1, pour la vérification qui tranche
> vraiment (`idl-check.mjs`), toujours non exécutée dans cet espace de
> travail.

---

## 9. Frontend — choix notables

**Routing par hash.** `src/lib/router.ts`, pas de `BrowserRouter`. Permet un
déploiement statique sans règle de réécriture serveur. Contrepartie : les URL
portent un `#`, et le référencement en souffre. Acceptable pour une app
derrière un wallet, à reconsidérer si les fiches publiques deviennent un
canal d'acquisition. Deux routes ajoutées le 29/08 : `/network` (fil social)
et `/leaderboard` (classement + journal de quêtes) — même mécanisme, une
entrée dans le type `Route` et dans `VALID`, sans quoi le lien « ne fait
rien » silencieusement (voir §11).

**i18n maison.** `src/lib/i18n/`, FR par défaut. Une dépendance de moins pour
deux langues et un volume de chaînes modeste (710 clés par langue au 29/08,
parité vérifiée par transpilation réelle des dictionnaires). Le jour où une
troisième langue arrive avec des règles de pluriel, la question se repose.

**Rotation RPC.** `src/lib/constants.ts` maintient deux curseurs de rotation
**indépendants**, un pour la lecture et un pour l'écriture — voir
`FEUILLE_DE_ROUTE.md` pour l'incident qui a motivé cette séparation
(`getProgramAccounts` refusé en permanence par Helius, -32401). Helius reste
en tête en écriture parce que c'est un nœud unique : derrière un load
balancer, une transaction peut être envoyée à un nœud qui n'a pas encore vu
le blockhash, d'où les « Blockhash not found » intermittents.

**Deux noms de variable pour le RPC.** `VITE_RPC_ENDPOINT` (canonique) et
`VITE_REACT_APP_SOLANA_RPC_URL` (hérité). Le double lookup existe parce que
seul le second était présent dans `.env` : sans lui, la clé Helius n'était
jamais lue et le front tombait directement sur Ankr.

---

## 10. Configuration et clés

### Variables d'environnement

| Variable | Rôle | Conséquence si absente |
|---|---|---|
| `VITE_SUPABASE_URL` | Projet Supabase | Backend entièrement muet |
| `VITE_SUPABASE_ANON_KEY` | Clé publique | Backend entièrement muet |
| `VITE_RPC_ENDPOINT` *(ou l'ancien nom)* | RPC dédié | Repli sur les RPC publics |

Tout ce qui est préfixé `VITE_` finit dans le bundle et est **public**. La
clé anon l'est par nature — c'est la RLS qui protège les données, pas le
secret de cette clé. Une `service_role` ne doit jamais s'y trouver ; elle est
injectée par Supabase dans l'environnement des Edge Functions. Voir §12 pour
le rapprochement avec le scan de sécurité Noah du 29/08, qui signale
justement cette clé.

L'absence des deux premières ne produit **aucune erreur** : `isRemoteEnabled`
passe à `false` et l'application se contente de ne rien remonter. C'est le
mode de panne le plus difficile à diagnostiquer du projet.

### Clés

| Fichier | Contenu | Statut |
|---|---|---|
| `contracts/target/wallet/wallet.json` | Autorité d'upgrade | présent |
| `contracts/target/wallet/id.json` | Copie, nom attendu par Anchor | présent |
| `contracts/target/deploy/workspace-keypair.json` | Keypair du programme | **absent** |

Sur le keypair du programme : il est irrécupérable — une clé privée ne se
déduit pas d'une adresse publique. Il n'est cependant **pas nécessaire**. Il
ne sert qu'au premier déploiement à une adresse donnée, qui a déjà eu lieu.
Les upgrades n'engagent que l'autorité d'upgrade. Le seul scénario bloquant
serait un redéploiement à la même adresse après suppression du programme, ce
qui n'est pas un cas atteignable ici.

`scripts/keys-check.mjs` dérive les pubkeys réelles des keypairs présents et
les compare à l'autorité attendue et au program ID, plutôt que de faire
confiance à un commentaire. Un fichier de keypair n'est qu'un tableau de 64
octets : rien, à le regarder, ne dit à quelle adresse il correspond — d'où le
risque de découvrir l'erreur au moment d'un `anchor upgrade`, c'est-à-dire
trop tard.

> ⚠️ `wallet.json` est une clé privée en clair, versionnée. Acceptable en
> devnet, et seulement là. Avant tout mainnet : régénérer l'autorité, la
> sortir du dépôt, considérer celle-ci comme brûlée.

---

## 11. Diagnostic rapide

| Symptôme | Piste |
|---|---|
| Rien ne charge côté social, aucune erreur | Variables Supabase absentes → `isRemoteEnabled === false` |
| Variable ajoutée mais toujours rien | Vite ne relit `.env` qu'au démarrage — relancer `npm run dev` |
| « Message de signature invalide » | Libellé désynchronisé entre `projectWrite.ts` (ou `network-write`) et la regex serveur |
| Une écriture disparaît sans erreur | Appel direct à `supabase.from(...).insert()` sur une table verrouillée |
| « Seul le founder… » adressé au founder | Décodage on-chain faussé — ordre des champs de `Project` modifié ? |
| `InvalidParameter` (6005) à la signature | Bornes du front supérieures à celles du programme déployé |
| « Blockhash not found » intermittent | RPC derrière load balancer — vérifier que Helius est bien en tête en écriture |
| Popup de signature en boucle sur le chat | Horloge locale décalée de plus de 60 s |
| Un lien de nav « ne fait rien » | Route absente du type `Route` **et** du tableau `VALID` dans `router.ts` |
| Bannière/thème effacés après une sauvegarde de profil | Objet profil partiel envoyé à `submitProfileUpdate` — un champ absent est écrit comme vide, pas ignoré |
| Tout le texte disparaît en changeant de mode clair/sombre | Une couleur de texte pointe vers `--ink-900-rgb` au lieu de `--text-primary-rgb` (voir §0) |
| Un composant « livré » n'existe plus sur le disque | Resynchronisation Noah / dépôt local — voir `FEUILLE_DE_ROUTE.md`, section dédiée. Vérifier le fichier avant de construire dessus. |

---

## 12. Réseau social & gamification (ajoutés le 28-29/08)

Deux couches hors-chaîne construites sur le même modèle de sécurité que le
reste (§2) : aucune écriture publique, tout passe par une Edge Function.

### Réseau (fil social transversal)

`network-write` couvre `post` / `react` / `comment` / `delete-post` /
`post-media-upload-url`, signature ed25519 fraîche à chaque appel — pas de
session longue durée comme le chat, le volume attendu est plus faible.
Trois tables (`network_posts`, `network_post_reactions`,
`network_post_comments`), RLS restrictive : SELECT public, aucune policy
d'INSERT/UPDATE/DELETE client, tout passe par la fonction en `service_role`.

Le fil ne distribue **volontairement** aucun XP : poster n'est pas un acte
on-chain, en récompenser l'attribution ouvrirait un vecteur de spam pour de
l'XP gratuit (voir `GAMIFICATION_PLAN.md`).

### Gamification

L'XP est un **ledger append-only** (`xp_events`), écrit uniquement côté
serveur dans `project-write` (action `event`), juste après vérification
d'une transaction on-chain réelle — même mécanique de preuve que le journal
d'activité (§5), pas de nouveau modèle de confiance introduit. `src/lib/
gamification.ts` ne fait **que lire** : agrégation via la vue `wallet_xp`,
calcul de rang (`computeRank()`, 7 paliers, aucune table), badges (7,
calculés à la volée depuis `pact_events`, aucune table ni cache), quêtes
hebdomadaires (fenêtre lundi 00h→maintenant, calculée à chaque lecture).

Aucune règle de badge ou de quête n'est figée en base : les changer ne
demande aucune migration, au prix d'un recalcul à chaque lecture — largement
suffisant au volume actuel.

**Journal de quêtes V2 (29/08 nuit).** La récompense passe d'un crédit
implicite (jamais montré comme tel) à un geste explicite : bouton de
réclamation par quête complétée, revérifié côté serveur par une nouvelle
Edge Function `quest-write` — même schéma de sécurité que `project-write`
(signature ed25519 fraîche, message ancré, fenêtre de 5 min), le calcul de
progression restant public/client (`fetchWeeklyQuestProgress`). Nouvelle
table `quest_claims` (clé composite wallet/semaine/quête, écriture
service_role uniquement). Ajouts : série hebdomadaire (pas journalière —
une série journalière inciterait à des transactions on-chain juste pour ne
pas la casser, alors que chaque action coûte des frais réels), bonus de
complétion (+150 XP), % de rareté par badge et compteur de progression des
badges verrouillés (calculés en un seul fetch groupé sur `pact_events`,
pas une requête par wallet), onglet Chronique (historique lisible par
wallet). La semaine est désormais calculée en UTC (lundi 00h) des deux
côtés — remplace l'ancien calcul en heure locale du navigateur, qui pouvait
faire diverger l'affichage client de la vérité serveur près d'un
changement de jour selon le fuseau horaire du joueur.

**Bug corrigé le 29/08 (nuit), découvert en construisant la Chronique** :
la contrainte `pact_events.kind_chk` n'autorisait pas le kind `'create'`
depuis l'introduction de ce kind côté application (`project-write`,
`awardXp()`, `computeBadges()`) — chaque insert d'événement de création
échouait silencieusement. Migration `fix_pact_events_kind_check_add_create`
appliquée. **Non rétroactif** : aucun wallet n'a été recrédité pour ses
créations passées, seules les créations futures comptent désormais.

**Second bug corrigé le 29/08 (nuit), trouvé lors d'un premier test réel :**
réclamation de récompense de quête impossible (« signature invalide »).
Cause : `quest-write` vérifiait le message signé avec une regex ancrée
**sans accents** (`reclamation de quete`, `Quete:`) alors que le client
(`gamification.ts::claimQuestReward`) signe **avec accents**
(« réclamation de quête », « Quête: ») — un cas concret de la règle
générale « une regex ancrée doit matcher le message client à l'octet
près » (voir `CERVEAU_PROMPT.md`, règle 8). Corrigé et redéployé
(`quest-write` v2), et versionné dans le dépôt local pour la première
fois (`supabase/functions/quest-write/index.ts` n'avait jamais été
sauvegardé localement jusque-là, contrairement aux sept autres Edge
Functions).

### `ProfileSettingsModal` — un même composant, deux comportements de sauvegarde

Extrait de `MonProfilPage.tsx` pour être monté aussi sur `LeaderboardPage.tsx`.
Le point de conception qui mérite d'être noté : sur la page Profil, un
brouillon de profil est disponible (édition en cours), et le composant
l'enregistre tel quel avec le thème actif — une seule signature couvre tout.
Ailleurs, sans brouillon disponible, il **relit le profil distant juste
avant d'écrire** plutôt que de construire un objet partiel à la main — c'est
exactement la classe de bug qui avait causé l'effacement silencieux de
`bannerUrl`/`themePalette` à chaque sauvegarde de profil (un champ absent du
payload est traité par le serveur comme une valeur vide, pas comme
« inchangé », voir §6). Le comportement par défaut du composant est
maintenant conçu pour ne pas pouvoir reproduire ce bug, plutôt que de
compter sur la vigilance de chaque appelant.

---

## 13. Scan sécurité Noah (29/08) — vérifié un par un contre le code réel

Noah expose un scan Semgrep automatique. Quatre findings relevés sur un
instantané, chacun vérifié contre le dépôt réel plutôt que pris pour argent
comptant :

| Finding | Sévérité | Verdict |
|---|---|---|
| JWT (clé Supabase) codé en dur | Erreur | Faux positif attendu. `VITE_SUPABASE_ANON_KEY` vit dans `.env` (gitignored), lue via `import.meta.env` — jamais écrite en dur dans un fichier source. Le scan a détecté la valeur dans le **bundle buildé**, où Vite inline nécessairement toute variable `VITE_*` : c'est le fonctionnement normal du préfixe. La clé anon est conçue pour être publique, la sécurité vient des policies RLS. |
| Script tiers sans `integrity` (SRI) | Avertissement | Déjà réglé. Le script visé (`content.trynoah.ai/utils.js`, ancien injecteur du badge « Made with Noah AI ») est retiré de `index.html`, où il ne subsiste plus qu'en commentaire explicite. Le scan porte sur un instantané antérieur au retrait — à revérifier après le prochain build du preview. |
| `dangerouslySetInnerHTML` non constant | Avertissement | Risque réel faible. Le SVG (`QrCode.tsx`) est un QR code généré localement à partir d'une URL construite par l'app — aucune entrée utilisateur ne transite par ce champ. Déjà documenté dans le code lui-même. |
| Pollution de prototype (`node[part]`) | Avertissement | Déjà mitigé. C'est le résolveur i18n (`translations.ts`), qui garde explicitement `__proto__`/`constructor`/`prototype` avant toute indexation dynamique. Le scanner détecte le motif générique, pas la garde qui le précède. |

Aucun de ces findings n'a nécessité de correction de code ce jour-là. Deux
sont des faux positifs par construction, un est déjà résolu (à revérifier au
prochain build), un est un avertissement valide mais sur une entrée non
exploitable aujourd'hui.

---

## 14. Assistant Nexus — architecture BYOK (ajouté le 29/08 nuit)

Widget de chat flottant (bulle 🧭 en bas à droite), module **volontairement
découplé** : `src/lib/assistant.ts` + `src/components/AssistantChat.tsx`,
un seul point de montage dans `DashboardLayout.tsx`. Aucune table, aucune
autre fonction, aucun autre composant n'en dépend — retirable sans rien
casser ailleurs. Désactivé par défaut : `ASSISTANT_ENABLED` lit
`VITE_ASSISTANT_ENABLED` (`.env`, `false` par défaut), et le composant est
un no-op (`return null`) tant que ce flag n'est pas `true`.

### Modèle BYOK (Bring Your Own Key)

Décision explicite de l'utilisateur, pas un défaut choisi seul : BuildPact
ne paie et ne stocke **aucune** clé API. L'utilisateur colle la sienne
(Anthropic, ou tout endpoint compatible Chat Completions — OpenAI, Groq,
DeepSeek, OpenRouter…) dans les réglages du widget. Stockage
`localStorage` uniquement (`buildpact_assistant_config`), sans scope par
wallet — une clé API est un secret d'appareil, pas une préférence
d'identité à synchroniser (contrairement au thème, voir §0). Elle n'est
envoyée qu'à `assistant-chat`, à chaque message, jamais vers une table
Supabase.

`assistant-chat` (Edge Function, `verify_jwt: false`, aucune preuve
d'identité requise — volontaire, elle ne touche à aucune donnée
BuildPact) est un relais **sans état** : reçoit `{provider, apiKey,
model, baseUrl?, messages}`, appelle le fournisseur (`callAnthropic()` ou
`callOpenAiCompatible()`), renvoie `{ok, reply}` ou `{error}` — ne
persiste et ne journalise jamais la clé (le message d'erreur renvoyé au
client vient du fournisseur, jamais construit à partir de la clé).
Limites anti-abus (pas contre l'utilisateur, contre un usage comme relais
gratuit anonyme) : 40 messages max, 6000 caractères/message, 400
caractères de clé. `suspiciousOrigin()` journalise en avertissement
seulement (pas de blocage dur) tant que le domaine de prod final n'est
pas confirmé.

### Périmètre légal volontairement restreint

Décision explicite de l'utilisateur : le prompt système (`SYSTEM_PROMPT`
dans `assistant-chat/index.ts`) autorise Nexus à expliquer des concepts
réglementaires **généraux** (security, DAO, KYC/AML, variabilité par
juridiction) mais lui interdit tout conseil juridique ou financier
**personnalisé**, avec rappel de portée obligatoire en fin de réponse dès
que le sujet l'exige. Raison : risque réel d'exercice non autorisé du
droit, et la réglementation crypto varie énormément d'une juridiction à
l'autre. Le prompt rappelle aussi que toute modification du Program ID
ou du Config PDA doit être validée par un humain — Nexus peut esquisser
du code Anchor, jamais décider à la place de l'équipe.

### Réutilisation mobile prévue

`assistant-chat` est pensé pour être réutilisée telle quelle par un futur
clone Android (roadmap Seeker mobile, voir `CLAUDE.md`) — seul un
wrapper React Native serait à écrire, sans nouvelle logique serveur.

Vérifié : `tsc --noEmit` 0 erreur sur les fichiers touchés, parité i18n
FR/EN 778/778 clés (`assistant.*`).

---

## 15. Vue liste/grille/vignettes, soldes multi-tokens, tooltips (30/08)

### Vue liste/grille/vignettes — préférence partagée entre deux pages

`lib/viewMode.ts` définit `ViewMode = 'list' | 'grid' | 'compact'`,
persistée en localStorage sous une clé UNIQUE (`buildpact_view_mode`) lue
par `hooks/useViewMode.ts` et consommée à la fois par `PactsPage.tsx` et
`MarketplacePage.tsx`. Décision volontaire : c'est une préférence de
*lecture* (comment je veux voir des cartes de pact), pas une config par
page — changer le mode sur l'une change aussi l'autre. Même convention que
`density.ts` (compact/comfortable), qui reste un axe indépendant (densité
= espacement dans la vue liste ; viewMode = liste/grille/vignettes).

Chaque mode a sa propre profondeur d'information, par design :
- `list` : composants riches existants inchangés (`PactCard` — actions
  on-chain incluses ; `MarketplaceCard` — Postuler, comparateur). Aucune
  pagination sur Pacts en ce mode (comportement d'origine, ces cards sont
  déjà denses en infos, pas besoin de découper).
- `grid` / `compact` : nouveau `components/PactTile.tsx`, volontairement
  léger — bannière, titre, statut, vault, membres, un simple `<a
  href="#/pact/:pda">`, AUCUNE action on-chain. Le compromis est assumé :
  une vue dense sert à repérer/parcourir vite, pas à agir depuis la carte
  elle-même — l'action reste à un clic (la fiche publique).

`fallbackBannerStyle()` (dégradé de secours déterministe par PDA, déjà
utilisé par `MarketplaceCard`) est exporté depuis ce fichier et réimporté
par `PactTile.tsx` plutôt que dupliqué — un seul point de vérité pour
« à quoi ressemble un pact sans bannière uploadée ».

⚠️ Si un champ est ajouté à `ChainPact` et affiché dans `PactCard`/
`MarketplaceCard`, il n'apparaît PAS automatiquement dans `PactTile` — les
deux ne partagent aucune logique de rendu, seulement le type de données.

### Soldes multi-tokens du wallet — lecture seule, agnostique

`lib/tokenBalances.ts` : `fetchTokenBalances(connection, owner)` appelle
`connection.getParsedTokenAccountsByOwner(owner, { programId:
TOKEN_PROGRAM_ID })` et retourne TOUS les comptes SPL à solde non-nul,
avec un `symbol` reconnu seulement pour les mints listés dans
`KNOWN_MINTS` (+ `projectTokenMints()`, lu dynamiquement depuis
`VITE_SKR_TOKEN_MINT`/`VITE_SKG_TOKEN_MINT`). Choix délibéré : plutôt
qu'une liste de mints à afficher (risque de deviner une mauvaise adresse
et d'étiqueter le mauvais token), on part de ce que le wallet détient
RÉELLEMENT et on n'étiquette que ce qu'on peut prouver.

Un seul mint est codé en dur avec confiance : USDC devnet
(`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), mint officiel émis par
Circle, vérifié via `explorer.solana.com` et la doc Circle avant d'être
ajouté. Explicitement absents : USDT (aucun mint devnet officiel
documenté trouvé — un faucet tiers prétendant émettre de l'USDT devnet
s'afficherait générique, pas mal étiqueté) et ETH/BTC pontés Wormhole
(même raisonnement, aucun mint devnet stable identifié avec confiance).

Intégré dans `AppWalletButton.tsx` (nouveau `useEffect` parallèle à celui
du solde SOL, même pattern cancel-on-unmount) puis affiché dans
`WalletButton.tsx` sous le solde SOL, seulement si `tokenBalances.length
> 0` (pas de bruit visuel pour un wallet qui n'a que du SOL).

**Ce composant NE COUVRE PAS le paiement.** Financer un pact avec un
token SPL demanderait de nouvelles instructions Anchor (vault en ATA par
mint, `transfer_checked`, logique de distribution adaptée par token — voir
`MULTI_TOKEN_FUNDING_PLAN.md`). Ça touche au programme et au Config PDA :
refusé sans GO explicite (règle absolue du projet, voir
`CERVEAU_PROMPT.md`). C'est NOAH qui gère les évolutions du Program ID —
un futur assistant qui reprend ce dossier ne doit pas s'engager dans ce
chantier de sa propre initiative.

### `InfoTooltip` — portail `position: fixed`, pas `absolute`

Ancienne implémentation : `<span class="absolute ...">` positionné
relativement à son propre conteneur via CSS pur (`group-hover`). Cassait
dans tout parent `overflow-y-auto` (ex. `ProfileSettingsModal`) : la bulle
dépassant le cadre visible était purement et simplement rognée — bug réel
trouvé en test live, invisible en lecture de code (les classes Tailwind
semblaient correctes).

Nouvelle implémentation : la bulle est montée dans un `createPortal(...,
document.body)`, en `position: fixed`, positionnée au survol/focus via
`btnRef.current.getBoundingClientRect()` (clampée aux bords d'écran par
`EDGE_MARGIN`), et fermée sur `scroll`/`resize` (une bulle fixe ne suit
pas le scroll d'un conteneur parent — la repositionner à chaque pixel
défilé serait coûteux et jamais fluide, donc on la ferme plutôt, comme la
plupart des tooltips de ce type). Même mécanique que `ImageHoverPreview.tsx`
(déjà en portail pour la même raison de clipping).

Deuxième correctif, découvert après coup : fermeture trop rapide.
`onMouseLeave` fermait instantanément — impossible de traverser le petit
espace entre le bouton (16×16px) et la bulle sans qu'elle disparaisse
avant, et la bulle était `pointer-events-none` donc même l'atteindre ne
servait à rien. Fix : `CLOSE_DELAY = 250ms` avant fermeture réelle
(`setTimeout`, annulé par `cancelClose()` si le curseur revient sur le
bouton OU entre sur la bulle — qui a maintenant ses propres
`onMouseEnter`/`onMouseLeave` et `pointer-events-auto`). Le clavier
(focus/blur) reste sans délai — plus prévisible pour ce mode
d'interaction.

⚠️ Ne pas ajouter un `<InfoTooltip>` à côté d'un texte déjà affiché en
permanence avec le même contenu (`<p>{t('x.hint')}</p>` juste en dessous
d'un `<h4>...<InfoTooltip text={t('x.hint')} /></h4>`) — c'est exactement
le doublon nettoyé le 30/08 sur plusieurs réglages (RPC, notifications,
export CSV, densité, palette, confidentialité). Le "?" n'a de sens que
quand c'est la SEULE explication disponible.

Vérifié à chaque étape : `tsc --noEmit` 0 erreur nouvelle, parité i18n
FR/EN 773/773 clés, test live via l'extension Chrome de l'utilisateur
(localhost, wallet réel) — bascule de vue, recherche, tooltips, panneau
plein écran, tous confirmés sans erreur console.

---

## Financement multi-token — implémentation programme (30/08, non déployée)

### `fund_spl(ctx: Context<FundSpl>, amount: u64)`

```rust
token::transfer_checked(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        token::TransferChecked {
            from: ctx.accounts.funder_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_vault.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        },
    ),
    amount,
    ctx.accounts.mint.decimals,
)?;
```

`token_vault` est un PDA `["token_vault", project, mint]` qui EST son
propre compte-jeton (`token::authority = token_vault` dans la contrainte
`#[account(...)]`), pas une vraie ATA dérivée séparément — évite une
couche de dérivation supplémentaire côté client. Créé au premier
`fund_spl` sur ce mint via `init_if_needed`, payé par le financeur.
Garde-fou identique à `fund()` : uniquement après `ProjectStatus::Finalized`.

### `distribute_spl<'info>(ctx: Context<'_, '_, '_, 'info, DistributeSpl<'info>>)`

Même arithmétique bps checked que `distribute()` (frais 2%, puis parts au
prorata de `share_bps`, tout en `u128` avec `checked_mul`/`checked_div`).
Différence clé avec le vault SOL : un compte-jeton n'a pas de loyer
superflu à soustraire — `token_vault.amount` est intégralement
distribuable (pas de `rent_min` à retrancher comme dans `distribute()`).

Les comptes-jetons des membres arrivent en `remaining_accounts`, non
typés par Anchor. Désérialisation manuelle avant tout virement :

```rust
let target_token: Account<TokenAccount> =
    Account::try_from(target_info).map_err(|_| ErrorCode::InvalidMint)?;
require!(target_token.mint == mint_key, ErrorCode::InvalidMint);
require!(target_token.owner == member.wallet, ErrorCode::MemberMismatch);
```

Même esprit que le contrôle `target.key() == member.wallet` de
`distribute()`, appliqué au compte-jeton plutôt qu'au wallet natif.

### Nouveaux comptes/events/erreur

`FundSpl`, `DistributeSpl` (voir `lib.rs`) ; events `ProjectFundedSpl`,
`FundsDistributedSpl` ; erreur `InvalidMint` ajoutée **en fin d'enum**
(code 6023) — la RÈGLE D'OR de numérotation séquentielle documentée
au-dessus de `ErrorCode` est respectée.

⚠️ **Non compilé.** Le sandbox Cowork n'a ni `cargo`, ni `rustc`, ni
`anchor` — ce code a été relu à l'œil (conventions, accolades, cohérence
avec `fund`/`distribute`) mais jamais passé par `cargo check` ni
`anchor build`. À faire avant toute confiance : build local, tests
LiteSVM, confirmation du mint USDT devnet (l'adresse communiquée par
l'utilisateur duplique exactement le mint USDC déjà connu — probable
erreur de copier-coller, à vérifier avant utilisation).

`anchor-spl = "0.31.1"` était déjà dans `Cargo.toml` sans être importée
nulle part dans `lib.rs` — donc jamais liée au binaire jusqu'à ce commit.
`use anchor_spl::token::{self, Mint, Token, TokenAccount};` est le premier
import qui l'active réellement. Aucun changement de manifeste nécessaire.

### Bug FreeGrid — 2e correctif (drag cassé par le 1er)

Le 1er correctif du bug d'écrasement mobile lisait `layouts.lg` (le plan
complet par breakpoint) plutôt que le `layout` reçu par
`onLayoutChange(layout, layouts)`. Or `layouts` n'est mis à jour par
react-grid-layout qu'À LA FIN d'un geste de glissé/redimensionnement —
l'utiliser pour l'état React affiché figeait l'élément à sa position de
départ à chaque mouvement intermédiaire, rendant le drag impossible.

Correctif définitif (`FreeGrid.tsx`) : séparer affichage et persistance.
`setLayout` prend toujours le `layout` courant tel quel (fluide, quel que
soit le breakpoint) ; la sauvegarde localStorage est conditionnée à
`onBreakpointChange` rapportant `'lg'` — seul breakpoint qui a un sens
pour une grille libre (le breakpoint `'sm'` n'a qu'une colonne).

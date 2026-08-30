# BuildPact — Feuille de route

> Dernière mise à jour : 30 août 2026 (soir)
> Document unique. Il n'y a pas de `ROADMAP.md` séparé : deux fichiers
> disant la même chose divergent dès la première mise à jour, et on ne sait
> alors plus lequel fait foi.

Les priorités sont classées par **risque décroissant**, pas par ordre
d'envie. Chaque entrée dit ce qui casse aujourd'hui, pas seulement ce qui
serait agréable.

---

## Priorité 1 — Confirmer le binaire déployé sur devnet

**Statut : VÉRIFIÉ le 29/08 (soir), directement dans cet espace de travail.**

> Une version antérieure de cette feuille annonçait ici un « bug actif » au
> motif que l'IDL ne contenait pas `update_description`. C'était une erreur
> de lecture : l'instruction y est bien présente. La priorité reste, mais
> elle change de nature — il s'agit de vérifier, pas de réparer.

Les trois artefacts du dépôt sont cohérents entre eux : `lib.rs`, l'IDL et
`onchainLimits.ts` décrivent tous le build du 27/08 avec les bornes hautes
(80 / 500 / 32) et `update_description`.

Le problème est qu'ils sont **tous les trois dans le dépôt**. Ils peuvent
être d'accord entre eux et décrire un binaire qui n'est pas en ligne : le
champ `address` d'un IDL est déclaratif, et `PROGRAM_UPGRADED` est un
booléen écrit à la main. Aucun des deux ne se vérifie contre la chaîne.

Si le binaire en ligne était l'ancien, deux symptômes suivraient :

- `MigratePactButton` appellerait une instruction inconnue du dispatcher —
  erreur technique illisible pour l'utilisateur ;
- plus grave parce que plus fréquent : le formulaire accepterait 500 octets
  de description, et la signature échouerait en `InvalidParameter` (6005)
  **après** que tout ait été rempli.

**Marche à suivre :**

1. `node scripts/idl-check.mjs` — verdict complet en une commande. Le script
   simule deux appels `update_description` sur un vrai compte Project :
   - une description d'1 octet → si le programme répond
     `InstructionFallbackNotFound` (101), l'instruction est absente, donc
     c'est l'ancien binaire ;
   - une description de 400 octets → un refus en `InvalidParameter` (6005)
     prouve que la borne en ligne est inférieure à 400, donc encore à 280.

   Le second test est le plus utile : il mesure la borne **réelle** au lieu
   de la déduire de la présence d'une instruction. Aucune clé privée n'est
   nécessaire, aucune transaction n'est envoyée. `VERBOSE=1` affiche les
   logs de simulation.

2. Selon le verdict :
   - **cohérent** → rien à faire, noter la date de vérification ici ;
   - **le front autorise plus que le programme** → passer
     `PROGRAM_UPGRADED` à `false` **immédiatement**, puis planifier
     l'upgrade. C'est le seul cas dangereux pour l'utilisateur ;
   - **le programme accepte plus que le front** → sans risque, basculer le
     drapeau à `true` quand on le souhaite.

3. `node scripts/keys-check.mjs` pour confirmer que l'autorité d'upgrade du
   dépôt correspond bien à celle enregistrée on-chain — sans quoi l'upgrade
   du point 2 échouera au dernier moment.

Ne pas basculer le drapeau à l'aveugle dans un sens ou dans l'autre : c'est
ce qui rend l'état actuel invérifiable de mémoire.

> **Résolu le 29/08 (soir).** `node scripts/idl-check.mjs` a été exécuté
> directement dans cet espace de travail (pas seulement rappelé de mémoire
> d'une session précédente) :
>
> ```
> 3. Instruction update_description (marqueur du build du 27/08)
>   ✓ PRÉSENTE dans le programme déployé → build du 27/08 en ligne
> 4. MAX_DESC_LEN réel on-chain (sonde à 400 octets)
>   ✓ 400 octets ACCEPTÉS → borne déployée ≥ 400 (500)
> 5. Cohérence avec src/lib/onchainLimits.ts
>   ✓ COHÉRENT — le front et le programme déployé sont alignés
> ```
>
> Dernier déploiement au slot 489196256 (2026-08-28T04:23:50Z), upgrade
> authority `8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6`. Le front et le
> binaire déployé sont bien alignés — `PROGRAM_UPGRADED = true` est correct,
> pas besoin de le basculer. Cette priorité descend donc du haut de la
> liste ; `keys-check.mjs` (point 3 de la marche à suivre ci-dessus) reste
> à lancer une fois avant tout futur `anchor upgrade`, mais ce n'est plus
> une urgence.

---

## Priorité 1bis — `wallet.json` ne correspond plus à l'autorité d'upgrade on-chain

**Statut : découvert le 29/08 (soir), en vérifiant la priorité 1. Bloquant
pour un futur `anchor upgrade`, pas pour l'usage courant de l'app.**

`node scripts/keys-check.mjs`, exécuté dans la foulée de la vérification
ci-dessus, donne :

```
✗ contracts/target/wallet/wallet.json → 7M2CKURpuooE22P7ZC1xgLB27SvB2LDmUP22wkrA3JA
  attendu : 8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6
  contracts/target/wallet/id.json — absent
  contracts/target/deploy/workspace-keypair.json — absent
✗ aucun fichier ne correspond à l'upgrade authority — un upgrade échouerait

✓ upgrade authority on-chain = 8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6
```

Une mémoire de session antérieure (28/08) affirmait cette clé « corrigée et
vérifiée deux fois ». Ce n'est manifestement plus l'état du disque
aujourd'hui — nouvel exemple concret de la resynchronisation Noah / dépôt
local qui réécrit des fichiers avec un état antérieur (voir la section
dédiée plus bas). Le fichier contient actuellement une clé qui ne
correspond à rien d'utile ici (ni le program ID, ni l'autorité réelle).

**Ce que ça ne casse pas :** create/add_member/approve/finalize/fund/
distribute fonctionnent tous normalement — aucun n'a besoin de l'autorité
d'upgrade. **Ce que ça casserait :** tout `anchor upgrade` tenté avec ce
`wallet.json` échouerait immédiatement, sans toucher au programme en place
(l'upgrade échoue avant d'être soumis, pas en cours).

**Marche à suivre, à ne pas faire sans validation humaine (clé privée) :**
retrouver le fichier de clé privée correspondant à la pubkey
`8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6` (sauvegarde locale, coffre-fort
de clés, ou re-générer si elle est perdue — auquel cas il faudra transférer
l'autorité d'upgrade vers une nouvelle clé via une transaction signée par
l'autorité actuelle, ce qui suppose de la retrouver d'une façon ou d'une
autre), puis le placer à `contracts/target/wallet/wallet.json`. Revérifier
avec `node scripts/keys-check.mjs` avant tout `anchor upgrade`.

---

## Priorité 2 — Verrouiller le bucket de stockage

**Statut : faille ouverte, moins grave qu'avant mais réelle.**

Les policies d'écriture publiques sur `project_media` ont été fermées : on ne
peut plus changer l'URL enregistrée pour un projet dont on n'est pas founder.

Mais l'upload du **fichier** part toujours directement vers le bucket avec la
clé anon. Le chemin est déterministe (`<pda>/logo.png`), donc si le bucket
accepte les écritures publiques, on peut écraser l'image d'un tiers. L'URL en
base reste correcte — c'est le contenu servi derrière qui change.

Deux options, avec des coûts différents :

| Option | Avantage | Coût |
|---|---|---|
| Policies sur `storage.objects` | Simple, pas de code | Ne peut pas vérifier une signature Solana → au mieux, blocage total du public |
| Upload via Edge Function | Vérification founder complète | Binaire en base64, limite de taille, fonction plus lourde |

Recommandation : commencer par fermer l'écriture publique sur le bucket
(option 1), puis router l'upload par Edge Function si la contrainte de taille
le permet.

> Ne pas confondre avec le correctif du 28/08 sur l'upload de médias
> **réseau** (`network-write`, action `post-media-upload-url`) : celui-ci
> couvre les images postées dans le fil `/network`, pas les logos/bannières
> de projet visés ici. Les deux buckets restent à verrouiller séparément.

---

## Priorité 3 — Vérifier l'appartenance sur `project_updates`

**Statut : limite connue, impact modéré.**

La signature prouve **qui** poste, pas **s'il en a le droit**. L'auteur
affiché est donc toujours exact — pas d'usurpation possible — mais un wallet
étranger au pact peut publier une mise à jour sur sa fiche publique, sous son
propre nom.

Correctif : dans `project-write`, action `update`, lire le compte `Project`
on-chain et vérifier que le signataire figure dans `members` ou est le
`creator`. Le code de lecture existe déjà (`fetchProjectCreator`) ; il faut
l'étendre au décodage du `Vec<Member>`, ce qui est plus délicat car Borsh
sérialise les `String` en longueur variable — les offsets ne sont pas fixes.

Alternative moins coûteuse si le décodage s'avère fragile : accepter
uniquement le `creator`, quitte à restreindre plus que nécessaire.

---

## Priorité 4 — Tests d'intégration des Edge Functions

**Statut : dette, pas un bug.**

Sept fonctions portent désormais toute la sécurité en écriture du produit
(`network-write` s'est ajoutée aux six historiques le 28/08), et aucune n'est
testée automatiquement. Les regex de messages signés sont particulièrement
exposées : une modification d'un espace ou d'un accent casse l'action
correspondante, et le symptôme (« Message de signature invalide ») ne dit pas
quel côté a bougé.

Couverture minimale à viser, par fonction :

- signature valide → succès
- signature d'une **autre action** rejouée → refus (c'est l'anti-rejeu, le
  test le plus important)
- horodatage périmé → refus
- signataire non autorisé → refus

---

## Priorité 5 — Nettoyer les documents de travail à la racine

`RESTORE_STATE.md`, `RESUME_PROJET.md`, `BUILDPACT_MIGRATION_PLAN.md`,
`DOSSIER_TECHNIQUE.md`, `CERVEAU_PROMPT.md` et ce fichier coexistent. Il y a
du recouvrement, notamment entre `RESTORE_STATE.md` et `RESUME_PROJET.md`.

À trancher une fois que la priorité 1 est réglée : garder le résumé, le
dossier technique et cette feuille de route ; archiver le reste dans
`docs/archive/` plutôt que de le supprimer — l'historique de décision a de la
valeur.

**Fait le 28/08 pour le plan de migration.** Sa version du 27/08 (710 lignes,
écrite avant l'import du code) est archivée dans
`docs/archive/BUILDPACT_MIGRATION_PLAN_2708.md`, et `BUILDPACT_MIGRATION_PLAN.md`
contient désormais l'état réel. L'archive n'est pas du déchet : elle porte les
justifications détaillées des arbitrages on-chain, que la version courte se
contente de résumer.

Restent à trancher : `RESTORE_STATE.md`, qui recoupe largement
`RESUME_PROJET.md`. **Constat du 29/08 (soir) :** ce fichier, pourtant noté
« fusionné dans RESUME_PROJET.md §9 » lors d'une session précédente, est
réapparu à la racine intact (486 lignes). Ce n'est pas une régression locale
— c'est un exemple concret du phénomène décrit dans le nouveau §« Fiabilité
du double pipeline Noah / dépôt local » ci-dessous. Priorité 5 reste donc
non réglée, et il faut désormais vérifier l'état réel du disque avant de
recocher quoi que ce soit ici comme fait.

---

## Fait le 29/08 — interface et fiabilité

Aucun de ces points ne touche au programme on-chain : rien à redéployer.

**1. Bouton « Modifier la description » verrouillé après finalisation.**
Il s'affichait à tout founder sans regarder `pact.status`. Le programme, lui,
rejette `update_description` dès que le projet n'est plus `Open`
(`require!(project.status == ProjectStatus::Open, ErrorCode::AlreadyFinalized)`,
erreur **6014**). Le founder signait donc une transaction condamnée d'avance.
Ce verrou est volontaire côté programme — laisser réécrire un texte que les
autres membres ont déjà approuvé viderait la signature de son sens. Le correctif
est côté UI : sur un pact finalisé, le bouton devient
`🔒 Description verrouillée (finalisé)` avec l'explication en infobulle.

**2. `@babel/parser` ajouté aux dépendances.** `plugins/component-tagger.ts`
l'importe en première ligne, mais il n'était déclaré nulle part. Tant qu'un
`node_modules` hérité le fournissait en transitif, tout marchait ; un
`rm -rf node_modules && npm install` propre le faisait disparaître et Vite
refusait de démarrer. Panne invisible à l'install, visible au boot.

**3. Typage des erreurs.** Les `catch (e: any)` de `PactCard.tsx` sont passés en
`catch (e)` (donc `unknown`, ce qui est correct : en JS on peut lancer autre
chose qu'un `Error`). `parseTxError` annonçait `unknown` mais faisait `err as any`
en interne — elle lit désormais l'erreur via une interface `AnchorLikeError`
décrivant les deux seuls champs consultés.

**4. Aperçu image au vrai format.** Nouveau composant `ImageHoverPreview.tsx`,
branché sur les logos et bannières de `PactCard` et `MarketplaceCard`. Au survol,
l'image s'affiche en entier (`object-contain`, ratio d'origine) au lieu du
recadrage `object-cover` de la miniature. Deux contraintes ont dicté
l'implémentation : l'overlay passe par un **portail** sur `<body>` (les cards ont
`overflow-hidden` pour le bleed de bannière, un overlay enfant serait découpé),
et il est désactivé sur pointeur tactile (un tap émet un faux `mouseenter`).

**5. Premier passage « premium ».** Comparaison des captures V1/V1.1 (référence)
et V2/V2.2 (actuel) : pas de régression, les deux sont quasi identiques. La base
(Space Grotesk/Mono, orbes flottants, `grid-bg`) tenait déjà ; c'est la grille de
cards qui était plate. Ajouts strictement additifs :

- `.btn-primary` en dégradé violet→indigo avec halo au survol (pas violet→rose :
  ce dégradé-là est la signature visuelle la plus reconnaissable d'une UI
  générée) ;
- `.btn-neon` vert pour les actions monétaires (fund / distribute / claim) —
  séparer la couleur de l'argent de celle de la navigation rend un pact lisible
  d'un coup d'œil ;
- `.card-lift` : élévation + halo violet au survol des cards ;
- tout est neutralisé sous `prefers-reduced-motion`.

---

## Étudié le 29/08 — BoomFi comme rampe d'accès fiat

**Statut : non engagé. Compréhension du service, pas une décision.**

[app.boomfi.xyz](https://app.boomfi.xyz/) est une passerelle de paiement crypto
non-custodiale, multi-chaînes (Solana incluse). Trois niveaux d'intégration :
paylink no-code, checkout embarqué, ou API complète. Les fonds transitent
directement de l'acheteur au marchand — BoomFi ne les détient jamais.

Mécanique concrète : le back-end crée un *paylink* via `POST /v1/paylinks`
(clé `X-API-KEY`), l'utilisateur est redirigé vers `pay.boomfi.xyz/<id>`, paie en
crypto ou par carte, puis un webhook signé (RSA/SHA-256, en-têtes
`X-BoomFi-Signature` + `X-BoomFi-Timestamp`) notifie le succès. Le champ
`reference` posé à la création est ce qui permet de rattacher le paiement à un
utilisateur — c'est le pivot de toute l'intégration.

**Intérêt pour BuildPact :** un backer sans wallet approvisionné pourrait
financer un pact par carte ou dans un autre token, BoomFi convertissant et
routant vers le vault PDA. C'est une **rampe d'accès en amont**, pas un
remplacement de l'escrow Anchor — la garantie du produit reste le programme
on-chain, BoomFi ne fait qu'amener les fonds jusqu'à lui.

**Ce que ça coûte avant de commencer :** un compte marchand BoomFi, une clé API
et une clé publique de webhook (test et prod sont distinctes), deux Edge
Functions (`create-boomfi-payment`, `boomfi-webhook`), et surtout une réponse à
une question non technique : qui est le marchand légal côté KYC ? Un paiement
fiat entrant fait sortir le produit du périmètre purement on-chain. À trancher
avant d'écrire une ligne de code.

---

## Fait le 29/08 (suite) — le vrai plafond était l'infra RPC

**1. Aperçu image : `object-contain` ne redimensionnait rien.**
Le correctif précédent posait `max-h`/`max-w` directement sur le `<img>`, sans
lui donner de boîte. Dans ces conditions `object-contain` n'agit que comme un
**plafond** : une bannière haute résolution gonflait jusqu'à 86vw/78vh, et un
petit logo restait affiché à sa taille native, minuscule au centre de l'écran.
Chaque aperçu a maintenant une vraie boîte dimensionnée selon `kind`
(`logo` ≈ carré 320px, `banner` ≈ 880×495) — `object-contain` fait alors son
travail dans les deux sens : il agrandit les petites images et réduit les
grandes, toujours au ratio d'origine.

**2. Helius refuse `getProgramAccounts` — de façon permanente.**
Erreur `-32401`, confirmée par trois voies (curl, fetch direct, l'application
elle-même), 100 % des essais. Ce n'est pas un incident : un scan complet de
programme est coûteux et couramment réservé aux plans supérieurs. Or c'est
l'appel qui liste tous les pacts.

Les endpoints sont donc **séparés par usage** dans `constants.ts` :

- **lecture** → devnet public d'abord (il sait faire `getProgramAccounts`) ;
- **écriture** → nœud dédié d'abord, inchangé (c'est lui qui avait réglé les
  « Blockhash not found », on n'y touche pas).

Deux curseurs de rotation indépendants : un 429 en lecture ne doit pas
déplacer l'endpoint d'écriture. Ankr a été retiré (l'endpoint devnet public
ne répond plus, il exigeait une clé) — le garder en position 2 faisait perdre
une rotation entière à chaque incident. Ajout d'un backoff progressif et d'un
discriminant `isMethodNotAllowedError` : un throttle se résorbe, un bridage de
méthode jamais, donc réessayer sur le même endpoint est du temps perdu.

**3. Treasury : ~90 appels RPC → 2.**
La page reconstruisait son historique depuis la chaîne : pour chaque vault un
`getSignaturesForAddress`, puis un `getParsedTransaction` par signature. Pour
6 pacts × 15 signatures, environ 90 requêtes à chaque ouverture. Le devnet
public throttlait bien avant la fin — le retry interne de web3.js lui-même
s'épuisait (500ms→1s→2s→4s) avant d'abandonner.

Ce n'était donc plus un bug de code mais un **plafond d'infrastructure** :
aucun backoff ne peut inventer de la capacité RPC. Plutôt que d'ajouter des
webhooks Helius ou la DAS API (l'infra supplémentaire envisagée au départ), on
a vérifié ce qui existait déjà : **`pact_events` enregistre chaque fund et
chaque distribute avec son montant**, au moment même de la transaction — la
même table qui alimente déjà l'XP et le fil d'activité. Le Treasury
refabriquait à grands frais une donnée déjà stockée. Il la lit maintenant
directement.

La chaîne reste la source de vérité : chaque flux affiché porte son `tx_sig`,
cliquable vers l'explorer. Cette table n'est qu'un **index**, jamais une
preuve.

---

## Fait le 29/08 (3ᵉ passe) — thème, badge, et une régression silencieuse

### Le chat des pacts avait vraiment disparu

Ce n'était pas une impression. `PactPublicPage.tsx` — la fiche
`#/pact/<pda>` — ne montait plus que `<PactCard>`, alors qu'un commentaire
de `PactCard.tsx` annonçait explicitement que cette page « rend chat + vault
juste en dessous ». `ChatBox.tsx` et `VaultPanel.tsx` existaient toujours et
fonctionnaient parfaitement : ils n'étaient simplement plus montés nulle
part, perdus dans un refactor antérieur.

C'est le pire profil de bug possible : **aucune erreur, aucun log, la page
s'affiche normalement**. Seule une fonctionnalité entière manque. Rien en
base n'avait été perdu — l'historique des messages est intact et réapparaît
tel quel une fois le composant remonté.

### Traduction : parité FR/EN vérifiée, un vrai oubli corrigé

Le pied de page affichait `Built on` / `Unaudited — Devnet only` **même en
français**. Le mécanisme `t()` fonctionnait parfaitement : il renvoyait
fidèlement ce qu'on avait écrit dans `fr.ts`. La clé existait, rien ne
levait, le texte s'affichait. Aucun outil ne signale ce cas — seule une
relecture le détecte. Corrigé en « Construit sur » / « Non audité — Devnet
uniquement ».

### Badge d'écosystème Seeker · Nexus

Remplace l'ancien badge injecté par l'outil, au même emplacement (flottant
en bas à droite, toutes les routes). Deux points d'implémentation :
`pointer-events-none` sur le conteneur avec réactivation sur le seul lien,
sinon la zone morte autour du badge bloquerait les clics de la page en
dessous ; et il lit les variables de thème, sinon il jurerait dès qu'un
builder change de palette.

Le script tiers qui injectait l'ancien badge (`content.trynoah.ai/utils.js`)
a été retiré de `index.html`, où il ne subsiste plus qu'en commentaire —
volontairement laissé pour empêcher qu'il soit réintroduit par erreur (voir
le nouveau § scan sécurité ci-dessous).

### Système de thème — palettes d'accent, livrées

**Livré :** le fond ne bouge jamais, seule la triade d'accent change. Trois
palettes — `violet` (défaut Solana), `cyan`, `coral`. Sélecteur dans
l'en-tête (≥ lg) et dans le menu mobile.

**Choix mémorisé par wallet** : chaque builder retrouve sa palette. La
synchronisation multi-appareils passe par la colonne `theme_palette` sur
`builder_profiles`, validée côté serveur par `update-profile` — voir la 4ᵉ
passe ci-dessous pour le câblage client, qui a suivi.

> **Correction du 29/08 (soir) :** une version antérieure de cette section
> annonçait « bascule clair/sombre écartée » au motif que tout le design est
> pensé fond noir + néons, et que la retravailler partout risquait de
> dénaturer l'identité pour un bénéfice discutable. Le builder a explicitement
> redemandé cette option **en plus** de la palette d'accent, pas à sa place.
> Voir la 4ᵉ passe : elle a finalement été livrée, en gardant le
> raisonnement initial comme garde-fou plutôt que comme refus — orbes, glows
> et `grid-bg` restent volontairement calés sur le rendu sombre, seul le fond
> et le texte s'inversent en mode clair. L'historique de la décision reste
> ci-dessus parce qu'il explique **pourquoi** le mode clair a été construit
> de façon aussi minimale.

Détail structurant documenté dans `DOSSIER_TECHNIQUE.md` § 0 : les
variables portent des **canaux RGB séparés**, pas des hex. Y mettre un hex
casserait tous les modificateurs d'opacité du projet (`bg-accent-violet/20`)
**sans aucune erreur de build** — les éléments rendraient transparents.

### Sélecteur de pact de référence : des pacts cachés remontaient

Symptôme : les pacts de test (« Nexus Markdown Ünïcode », « Café »)
apparaissaient dans le menu déroulant du composeur de post.

Cause racine, plus intéressante que le symptôme : `HIDDEN_PACT_PDAS` était
une **constante privée** de `useProjects.ts`. Elle filtrait correctement la
grille, le Marketplace et le Treasury, mais aucune nouvelle surface
d'affichage ne pouvait la réutiliser — elle n'était ni exportée ni
découvrable. Une règle métier globale rangée dans le détail d'un hook
garantit que chaque nouvel écran repartira sans le filtre.

Extraite dans `src/lib/hiddenPacts.ts`, avec `isHiddenPact()` et
`filterVisiblePacts()`. **Règle : toute liste de pacts exposée à un
utilisateur passe par là.**

---

## Fait le 29/08 (4ᵉ passe) — mode clair/sombre, paramètres réutilisables, classement

### Mode clair/sombre — additif, pas un remplacement

Livré comme axe **indépendant** de la palette d'accent : `[data-theme]`
choisit la triade violet/cyan/coral, un nouvel attribut `[data-mode]`
choisit clair ou sombre. Les deux se combinent librement — un builder en
palette `coral` et mode clair obtient une combinaison jamais testée
explicitement mais qui découle mécaniquement des mêmes variables.

**Bug évité de justesse pendant l'implémentation**, qui vaut d'être noté
parce qu'il aurait été invisible en revue rapide : le texte par défaut du
`body` a d'abord été branché sur `--ink-900-rgb`, une variable existante et
déjà nommée « texte le plus sombre ». Sauf que cette variable est
délibérément **la même teinte quasi-noire dans les deux modes** (c'est un
ton d'emphase pour texte sur fond clair, pas le texte principal de la page).
L'utiliser pour le `body` aurait rendu tout le texte par défaut illisible en
mode sombre — noir sur noir. Corrigé par l'introduction d'une variable
dédiée, `--text-primary-rgb` (blanc en sombre, quasi-noir en clair), qui
porte maintenant à la fois le `body` et l'override ciblé de `.text-white`
(Tailwind ne traite pas `white`/`black` comme des variables : impossible de
les reteinter autrement qu'en surchargeant la classe).

Glows, orbes et `grid-bg` restent calés sur le rendu sombre — assumé, voir
la note de correction plus haut.

### `ProfileSettingsModal` — extrait, réutilisable

Le pop-up de paramètres (palette, mode, langue) vivait en dur dans
`MonProfilPage.tsx`. Extrait en composant autonome pour être monté aussi sur
la page Classement (`LeaderboardPage.tsx`). Point de conception : sur la
page Profil, il enregistre le **brouillon de profil en cours** avec le
thème (une seule signature couvre tout) ; ailleurs, sans brouillon
disponible, il va chercher le profil distant juste avant d'écrire, pour ne
modifier que le thème sans risquer d'écraser le reste — c'est exactement le
bug de perte silencieuse de `bannerUrl`/`themePalette` déjà rencontré une
fois sur ce projet, ici évité par construction plutôt que par vigilance.

`emptyProfile()` déplacé de `MonProfilPage.tsx` (copie privée) vers
`lib/profile.ts` (export) : une seule source de vérité pour la forme d'un
profil vide, pour ne pas avoir à synchroniser deux copies à chaque ajout de
champ.

### Classement et journal de quêtes — reconstruits après une perte silencieuse

`LeaderboardPage.tsx`, `XpBar.tsx`, `BadgeShelf.tsx` et `QuestBoard.tsx`
avaient **disparu du disque** entre deux sessions, alors que la couche de
données (`gamification.ts`) et `RankBadge.tsx` étaient restés intacts, et que
le suivi de tâches de session marquait encore ce travail comme terminé. Ce
n'est pas une régression de code — voir la nouvelle section ci-dessous sur
la fiabilité du double pipeline Noah / dépôt local, qui explique le
mécanisme et pourquoi il faut désormais vérifier le disque avant de faire
confiance à un statut « fait ».

Reconstruits à l'identique de la conception d'origine (`GAMIFICATION_PLAN.md`) :

- `XpBar.tsx` — progression vers le rang suivant, avec halo.
- `BadgeShelf.tsx` — badges débloqués (calculés à la volée, pas de table dédiée).
- `QuestBoard.tsx` — les 3 quêtes hebdomadaires (fund / approve / finalize),
  sans récompense XP propre : elles pointent vers des actions qui rapportent
  déjà de l'XP via `project-write`, objectif pédagogique plutôt qu'un second
  système de points.
- `LeaderboardPage.tsx` — classement global ou par pact (sélecteur), panneau
  perso (XP + badges + quêtes) pour le wallet connecté, et le pop-up de
  paramètres ci-dessus. Route `/leaderboard` ajoutée à `router.ts`, lien de
  nav dans `DashboardLayout.tsx`.

### Vérification

Passe `tsc --noEmit` complète sur l'arborescence réelle (mêmes versions de
dépendances et même `tsconfig.app.json` que le projet), zéro erreur sur tous
les fichiers touchés — les seules erreurs restantes viennent de composants
`shadcn/ui` jamais réellement utilisés et de dépendances volontairement non
installées dans la vérification. Parité i18n FR/EN confirmée par
transpilation réelle des dictionnaires (710 clés de feuille de chaque côté,
0 manquante, 0 namespace dupliqué) plutôt que par une recherche textuelle —
une première tentative au regex/comptage d'accolades donnait de faux
doublons par collision de sous-chaînes, piège à ne pas reproduire.

---

## Fiabilité du double pipeline Noah / dépôt local

**Constat, pas une nouvelle tâche.** Noah travaille sur un miroir cloud de
ce projet ; ce dépôt local en est l'autre bout. Une resynchronisation entre
les deux a, plus d'une fois au cours d'une même journée, réécrit des
fichiers avec un état plus ancien : le namespace i18n `docs` dupliqué est
réapparu identique à lui-même après avoir été corrigé une première fois,
`MonProfilPage.tsx` a perdu son câblage bannière/thème, et l'ensemble
Classement/gamification décrit ci-dessus a disparu du disque pendant qu'un
suivi de tâches affirmait encore le contraire. `RESTORE_STATE.md` (voir
Priorité 5) obéit au même mécanisme : noté fusionné et supprimé, il est
réapparu intact.

**Ce que ça change concrètement pour la suite du projet :** un statut
« fait » — dans cette feuille de route, dans un suivi de tâches, ou dit en
conversation — décrit un état passé, pas forcément l'état présent du
disque. Avant de construire sur un composant ou une fonction déjà « livrée »,
vérifier qu'elle existe encore et compile, plutôt que de partir du principe
qu'elle est toujours là.

---

## Étudié le 29/08 (soir) — catalogue d'intégrations disponibles via Noah

**Statut : recensement, aucune intégration engagée.** Noah propose un
onglet *Integrations* avec trois catégories pertinentes pour BuildPact :

**Général** (IA, paiements, analytics) : OpenAI, Anthropic, xAI Grok, Google
Gemini, Perplexity (modèles de chat/complétion), ElevenLabs (voix), Google
AdSense, Google Analytics, **Stripe** et **BoomFi** (paiements).

**Protocoles Solana** : Metaplex (NFTs, Core/Umi), Debridge et LI.FI (ponts
cross-chain), Privy (auth sociale + gestion de wallet), Pump Fun Launchpad,
Coingecko (prix/market data), Meteora Swap, Jupiter Swap, Raydium Launchpad,
Raydium Swap, MagicBlock (paiements privés SPL), OKX Swap, Houdini Swap
(swaps cross-chain privés, 100+ chaînes).

**Smart Contracts** : 8 emplacements « Solana Contract » configurables —
un point d'ancrage générique pour lier n'importe quel programme Anchor
existant à l'app, pas un catalogue de programmes prêts à l'emploi.

### Ce qui a un usage concret pour BuildPact, par ordre de pertinence

1. **Jupiter Swap / Raydium Swap / Meteora Swap + Coingecko.** Pertinence
   directe et immédiate : `MULTI_TOKEN_FUNDING_PLAN.md` (spec écrite, non
   implémentée) prévoit de financer un pact en USDC/USDT/BTC/ETH via des
   vaults par mint. Un agrégateur de swap réglerait la conversion
   token-vers-token côté frontend si un backer ne détient pas exactement le
   mint attendu par le vault ; Coingecko donne le taux affiché avant
   confirmation. Ne remplace rien du plan déjà écrit — vient en complément
   au moment de l'implémenter.
2. **Privy.** Auth sociale (email/Google) qui provisionne un wallet
   embarqué. Intéressant pour l'onboarding d'un backer non-crypto qui ne
   veut pas installer Phantom avant de pouvoir financer un pact — mais
   change le modèle de garde des clés (custodial ou semi-custodial selon
   configuration) et donc la surface de confiance du produit. À ne pas
   engager sans trancher explicitement ce point.
3. **Metaplex.** Déjà dans la feuille de route produit long terme (S2 — NFT
   Card Game, `metaplex-skill` déjà listé dans `CLAUDE.md`). Rien de neuf,
   Noah donne juste un chemin d'intégration tout tracé le moment venu.
4. **Stripe.** Alternative on-ramp fiat à BoomFi (déjà étudié le 29/08
   matin, voir plus haut). Même question bloquante que BoomFi : qui est le
   marchand légal côté KYC, avant d'écrire une ligne de code.
5. **Pas de cas d'usage identifié pour l'instant** : OpenAI/Anthropic/Gemini/
   Grok/Perplexity (aucune fonctionnalité produit n'appelle un LLM
   aujourd'hui), ElevenLabs, Google AdSense (un réseau publicitaire sur une
   app de cap table on-chain irait à l'encontre du positionnement), Debridge/
   LI.FI/Houdini/OKX (redondants avec Jupiter/Raydium/Meteora pour le seul
   besoin identifié, qui est intra-Solana), MagicBlock (paiements privés —
   à l'opposé de la transparence recherchée pour un cap table).

Aucune ligne de code n'a été écrite pour ces intégrations. Elles ne
deviennent pertinentes qu'au moment d'implémenter `MULTI_TOKEN_FUNDING_PLAN.md`
(swap + prix) ou une décision produit explicite sur l'onboarding non-crypto
(Privy) et le on-ramp fiat (Stripe/BoomFi).

---

## Étudié le 29/08 (soir) — scan sécurité & performance Noah

**Contexte :** Noah expose un scan Semgrep automatique (onglet *Security*)
et un score Lighthouse (onglet *Performance*). Quatre findings de sécurité
relevés sur une capture, vérifiés un par un contre le code réel du dépôt.

| Finding Noah | Sévérité affichée | Verdict après vérification |
|---|---|---|
| JWT (clé Supabase) codé en dur dans le source | Erreur | **Faux positif attendu.** C'est `VITE_SUPABASE_ANON_KEY`, lue depuis `.env` (gitignored) via `import.meta.env`, jamais écrite en dur dans un fichier source. Le scanner l'a détectée dans le **bundle buildé**, où Vite inline nécessairement toute variable `VITE_*` — c'est le fonctionnement normal du préfixe, pas une fuite. La clé anon Supabase est conçue pour être publique ; la sécurité vient des policies RLS, pas du secret de cette valeur. Voir `DOSSIER_TECHNIQUE.md` §10. |
| Script tiers sans attribut `integrity` (SRI) | Avertissement | **Déjà réglé.** Le script visé (`content.trynoah.ai/utils.js`, celui de l'ancien badge « Made with Noah AI ») est retiré de `index.html` et n'y subsiste qu'en commentaire explicatif — voir la 3ᵉ passe du 29/08 ci-dessus. Le scan Noah semble porter sur un instantané antérieur au retrait ; à revérifier après le prochain build/déploiement du preview. |
| `dangerouslySetInnerHTML` sur du contenu non constant | Avertissement | **Risque réel faible, déjà documenté dans le code.** Le SVG injecté (`QrCode.tsx`) est généré localement à partir d'une URL construite par l'app elle-même — aucune entrée utilisateur ne transite par ce champ. Le commentaire en place l'explicite déjà. Pas d'action nécessaire tant qu'aucune saisie tierce n'alimente ce composant. |
| Pollution de prototype possible (`node = node[part]`) | Avertissement | **Déjà mitigé.** C'est le résolveur i18n (`translations.ts`, fonction `resolve`), qui garde explicitement `__proto__`, `constructor` et `prototype` (`FORBIDDEN_SEGMENTS`) avant toute indexation dynamique. Le scanner détecte le motif générique sans voir la garde qui le précède. |

**Verdict global :** aucun des quatre findings n'appelle une correction de
code immédiate — deux sont des faux positifs par construction (clé anon,
motif générique sans voir la garde), un est déjà résolu et attend juste un
nouveau build du preview pour disparaître du scan, un est un vrai avertissement
mais sur une entrée non exploitable aujourd'hui. À revérifier après le
prochain déploiement du preview Noah pour confirmer que le score passe de
1 erreur / 3 avertissements à 0 / 1 (le SRI devrait disparaître, le reste
restant des avertissements informatifs valides à garder en tête).

**Performance (Lighthouse via Noah) :** Performance 55 % → 54 % (variation
dans le bruit de mesure, pas une régression identifiée), Accessibilité
100 %, Bonnes pratiques 96 %, SEO 91 %. Les trois problèmes « High » listés
(First/Largest Contentful Paint, chaîne de dépendances réseau, requêtes
bloquant le rendu) sont cohérents avec une SPA React chargeant polices
Google Fonts + wallet adapter + Anchor avant le premier rendu utile — pas
une régression de cette session, un chantier de perf à part entière si le
produit en a besoin avant le hackathon suivant. Non engagé faute de priorité
supérieure aux items 1 à 4 ci-dessus.

---

## En cours — Réseau Builders

**Statut : livré.** Les six étapes listées lors de l'étude initiale
(migration Supabase, Edge Function `network-write`, `PostComposer`/`PostCard`,
page `BuildersNetworkPage.tsx`, onglet « Mes posts », bannière de profil) ont
toutes été appliquées : migration exécutée sur le projet Supabase réel,
fonction déployée (`verify_jwt: false`, signature ed25519), fil visible sur
`#/network`. XP volontairement absent de ce fil — voir `GAMIFICATION_PLAN.md`
pour la raison (poster n'est pas un acte on-chain, en récompenser
l'attribution ouvrirait un vecteur de spam pour XP gratuit).

---

## Ensuite — pistes produit

Aucune n'est engagée ; elles sont listées pour mémoire, sans ordre.

- **Passage en mainnet.** Prérequis non négociable : sortir `wallet.json` du
  dépôt, régénérer l'autorité d'upgrade, considérer l'actuelle comme brûlée.
  Tant que cette clé est versionnée en clair, un mainnet est hors de question.
- **Financement multi-token (USDC/USDT/BTC/ETH).** Spec écrite
  (`MULTI_TOKEN_FUNDING_PLAN.md`, vaults par mint, `fund_spl`/`distribute_spl`
  via `transfer_checked`), aucune ligne de programme écrite. Voir le
  catalogue d'intégrations ci-dessus pour les briques Noah pertinentes le
  jour de l'implémentation. **Lecture des soldes livrée le 30/08** (voir
  section datée en bas de ce document) — seul le paiement reste ouvert.
- **Notifications** sur candidature reçue et mise à jour publiée. Le fil
  d'activité existe déjà, il ne manque qu'un canal.
- **Historique de distribution** par membre dans la page Trésorerie.
- **Révocation d'une seule session** plutôt que du wallet entier. Suppose de
  passer du modèle *cutoff* à une liste de jetons — ce qui rouvre le problème
  qui a motivé le cutoff : révoquer un jeton qu'on n'a pas sous la main.
  À ne faire que si un besoin réel le justifie.
- **Vérification d'appartenance étendue** aux candidatures (empêcher de
  candidater sur son propre pact).
- **Onramp fiat** (BoomFi ou Stripe, voir sections dédiées ci-dessus).
  Bloquant non technique commun aux deux : identifier le marchand légal.

### Thème — suite possible

- **Palette visible par les autres** : afficher les posts et la fiche profil
  d'un builder dans SA palette. Mécanique sociale intéressante, mais
  attention — une page qui mélange plusieurs palettes redevient un
  patchwork. À limiter à la fiche profil, pas au fil.
- **Palette dérivée du logo du pact** : extraire la teinte dominante du logo
  uploadé et teinter la fiche du pact avec. Fort effet « sur-mesure » pour
  un coût modéré, et ça règle au passage l'hétérogénéité des bannières
  générées signalée plus haut.

### Pistes visuelles proposées, en attente de GO

1. **Écran d'accueil investisseur.** Un chiffre fort (SOL total sous escrow,
   nombre de pacts finalisés) plutôt qu'une grille immédiate. À discuter : c'est
   un choix produit, pas cosmétique.
2. **Vérifier avant toute démo investisseurs** que le badge « Made with Noah AI »
   n'apparaît pas sur le build Vercel de production — le script est retiré
   de `index.html`, mais un nouveau déploiement du preview Noah doit être
   revérifié après coup (voir le scan sécurité ci-dessus).


## 29/08 (soir) — Bug critique création de pact + réglages d'affichage

**Bug critique corrigé : le bouton "Créer un pact" ne menait plus nulle
part.** `CreatePactWizard.tsx` existait toujours dans le repo mais n'était
monté nulle part dans `App.tsx` — un commentaire dans `PactsPage.tsx`
documentait déjà le trou ("tant que la version amont n'est pas rapatriée")
sans que personne ne le comble. Le bouton retombait sur un repli qui
naviguait vers le Dashboard (`#/`), qui n'a lui-même aucun moyen d'ouvrir le
wizard : boucle morte, création de pact totalement inaccessible depuis
l'UI. `PactsPage.tsx` gère maintenant le wizard lui-même (état `showCreate`,
modal `fixed inset-0`), `onCreatePact` reste une prop optionnelle pour un
appelant externe mais n'est plus requise au fonctionnement. Vérifié par
`tsc` complet (0 erreur sur `PactsPage.tsx`, `CreatePactWizard.tsx` et ses
sous-composants `wizard/*`).

**Journal de quêtes converti en vrai pop-up.** Redemandé plusieurs fois —
`QuestBoard` était un panneau toujours visible dans la grille du
Leaderboard, pas le pop-up attendu. Bouton dédié "📜 Journal de quêtes"
à côté de "⚙️ Paramètres", ouvre `QuestBoard` dans une modal (même
gabarit que `ProfileSettingsModal`). Toujours 3 quêtes fixes par semaine
(fund/approve/finalize), aucun changement côté `lib/gamification.ts`.

**Nouveaux réglages d'affichage, tous dans le pop-up Paramètres :**

- **Palette + mode fusionnés** — `ThemeModeGrid.tsx`, 6 boutons (3 palettes
  × 2 modes) au lieu des 2 sélecteurs séparés (`ThemeSwitch` + `ModeSwitch`,
  qui restent utilisés tels quels ailleurs, ex. en-tête compacte).
- **Fond de page** — `BackgroundSwitch.tsx`, 5 styles : Nébuleuse (orbes,
  défaut historique), Grille pure, Fond uni, et 2 ajouts proposés : Aurore
  (bande de lumière diagonale, dérive 36s) et Scanlines (lignes rétro-
  terminal). Un seul contrôle plutôt que 2 réglages qui pourraient se
  contredire ("toggle orbes" + "choix de fond") — choisir Grille ou Uni
  éteint de fait les orbes. Persisté par wallet, même schéma que
  thème/mode (`lib/theme.ts` : `BackgroundStyle`, `loadBackground`/
  `saveBackground`).
- **Aperçu grand format (logo/bannière)** — `ImagePreviewSettings.tsx` :
  toggle activer/désactiver complètement, + choix du déclencheur (survol
  ou clic). En mode clic, le garde-fou "pointeur fin" d'`ImageHoverPreview`
  (qui bloquait le survol fantôme au tap mobile) ne s'applique plus — le
  clic est une action volontaire, il marche donc aussi au tap. Préférence
  d'appareil (pas de scope par wallet, contrairement à thème/mode/fond).
- **Fond noir de l'aperçu réduit** — remplacé l'aplat `bg-black/75` par un
  dégradé radial centré (0.55 → transparent), backdrop-blur allégé
  (`blur-sm` → 2px) : la zone sombre se concentre autour de l'image au
  lieu de noyer tout l'écran.

Tout vérifié par un `tsc --noEmit` complet sur l'arborescence modifiée :
0 erreur nouvelle (les ~11 erreurs restantes sont la baseline shadcn/ui/
Radix déjà connue, aucune dans les fichiers touchés ce soir).


## 29/08 (nuit) — Journal de quêtes V2 + thème premium V2

Suite directe de la section précédente. Périmètre 100% off-chain : nouvelle
table Supabase + une Edge Function + frontend/CSS. **Aucun fichier lié au
Program ID ou au Config PDA n'a été touché** (ni `lib.rs`, ni `anchor.ts`,
ni l'IDL) — cette précision est notée ici explicitement parce qu'elle a été
demandée avant de lancer le chantier, pour la coordination avec le miroir
Noah.

### Bug découvert et corrigé : `pact_events.kind_chk` n'acceptait pas 'create'

En construisant la Chronique (historique par wallet), la requête
`SELECT kind, count(*) FROM pact_events GROUP BY kind` a révélé **zéro**
ligne `create` et **zéro** ligne `add_member` en base, alors que le code
applicatif (`project-write`, `awardXp()`, `computeBadges()`) traite `create`
comme un kind valide et déclenche dessus de l'XP et 2 badges
(`serialFounder`, `firstMover`) depuis leur introduction. La contrainte
`kind_chk` sur `pact_events` n'autorisait que
`'approve','fund','finalize','distribute','add_member'` — chaque insert
d'événement `create` échouait silencieusement depuis le début.

**Corrigé** par la migration `fix_pact_events_kind_check_add_create`
(contrainte recréée avec `create` inclus). **Non rétroactif** : impossible
de reconstituer les créations de pacts passées sans rescanner tout
l'historique on-chain — aucun wallet n'a été crédité rétroactivement de
l'XP de création ni des 2 badges concernés. Les créations à partir de
maintenant sont correctement comptabilisées.

### Journal de quêtes V2

Toujours 3 quêtes hebdomadaires fixes (fund/approve/finalize), mais la
récompense passe d'un crédit automatique (implicite, jamais montré comme
tel) à un geste explicite :

- **Clic de réclamation** — bouton "Réclamer +N XP" par quête complétée.
  Le calcul de progression reste public/côté client
  (`fetchWeeklyQuestProgress`), mais la réclamation revérifie tout côté
  serveur (nouvelle Edge Function `quest-write`, jamais de confiance dans
  ce que le client déclare complété).
- **Série (streak) hebdomadaire**, pas journalière — décision volontaire :
  une série journalière inciterait à des transactions on-chain purement
  pour ne pas la casser, alors que chaque action coûte des frais réels.
- **Bonus de complétion** (+150 XP) quand les 3 quêtes sont réclamées la
  même semaine.
- **Rareté des badges** (% de wallets qui l'ont débloqué) et **progression
  des badges verrouillés** (ex. "7/10") — calculés en un seul fetch groupé
  sur `pact_events` plutôt qu'une requête par wallet.
- **Onglet Chronique** — historique lisible des événements on-chain du
  wallet (créations, approbations, financements, finalisations,
  distributions, ajouts de membre), pas seulement une case à cocher.

Nouveau côté Supabase : table `quest_claims` (clé composite wallet/semaine/
quête, écriture uniquement via la fonction serveur) et Edge Function
`quest-write`, qui suit exactement le même schéma de sécurité que
`project-write`/`update-profile` (signature ed25519 fraîche sur un message
ancré, fenêtre de fraîcheur de 5 minutes). Semaine calculée en UTC
(lundi 00:00 UTC) côté client ET serveur — remplace l'ancien calcul en
heure locale du navigateur, qui pouvait faire diverger le "complété" affiché
du "complété" vérifié selon le fuseau horaire du joueur.

### Thème premium V2

- **Échelle d'élévation** — `--surface-1/2/3-rgb`, aliasées sur
  `--accent-violet-rgb` (une variable CSS peut référencer une autre
  variable CSS) : les surfaces se reteintent automatiquement avec la
  palette active, sans dupliquer une valeur par palette. `.glass-panel`
  utilise maintenant `--surface-1-rgb`, nouvelles classes utilitaires
  `.surface-2`/`.surface-3`.
- **Curseur d'intensité des halos** (`--glow-strength`, 0/0.5/1) — variable
  CSS continue posée via `style.setProperty` (pas un attribut `data-*`,
  car elle est multipliée dans des `calc()` plutôt que sélectionnée par
  bloc). Multiplie l'alpha des halos existants (`.btn-primary:hover`,
  `.btn-neon:hover`, `.card-lift:hover`) sans dupliquer aucune règle.
  Réglage d'appareil (comme l'aperçu), pas par wallet.
- **Palette Aurum** — or comme accent principal (`#E8B84B`), parchemin en
  highlight, canevas noir chaud (`#0B0A08`) qui remplace le canevas sombre
  standard UNIQUEMENT en mode sombre (le mode clair d'Aurum reste le
  canevas clair standard).
- **Palette Atelier** — accent **violet conservé à l'identique** (aucune
  nouvelle teinte) ; sa distinction vient uniquement du canevas
  ivoire (`#F7F4EE`) / encre (`#1A1814`), **appliqué quel que soit le mode
  clair/sombre** — c'est le seul thème pensé pour rester "clair" même si
  le reste de l'app est en mode sombre.
- `ThemeModeGrid.tsx` passe de 6 à 10 boutons (5 palettes × 2 modes).

### Vérification

- `tsc --noEmit` complet sur l'arborescence copiée : **0 erreur** sur tous
  les fichiers touchés/créés (`ThemeContext.tsx`, `GlowStrengthSwitch.tsx`,
  `ThemeModeGrid.tsx`, `ProfileSettingsModal.tsx`, `lib/theme.ts`,
  `theme/palettes.ts`, `lib/gamification.ts`, `BadgeShelf.tsx`,
  `QuestBoard.tsx`, `index.css`, `fr.ts`, `en.ts`). Les erreurs restantes
  (baseline shadcn/ui/Radix déjà connue) sont hors périmètre.
- Parité FR/EN vérifiée par diff programmatique des clés (pas du regex) :
  **753/753 clés des deux côtés, 0 écart.**


## 29/08 (nuit) — Identité visuelle : favicon/méta corrigés, style validé

### Bloquant confirmé pour tout futur `anchor upgrade`

`node scripts/keys-check.mjs` relancé en direct : `wallet.json` ne
correspond toujours pas à l'autorité d'upgrade on-chain
(`8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6` attendu,
`7M2CKURpuooE22P7ZC1xgLB27SvB2LDmUP22wkrA3JA` présent). Tant que ce n'est
pas corrigé (retrouver/replacer la bonne clé privée, hors périmètre
assistant — validation humaine requise), **aucun `anchor upgrade` ne peut
être soumis**, y compris pour la seule fonctionnalité proche qui toucherait
le programme : le financement multi-devises (USDC/USDT/BTC-ETH pontés,
voir `MULTI_TOKEN_FUNDING_PLAN.md`, encore au stade proposition — aucune
ligne de programme écrite, en attente de GO). Aucun autre point du
roadmap proche (S2/S3/S4) n'a de spec on-chain concrète à ce jour.

### Identité visuelle — style validé : vectoriel 2D flat premium

Après inventaire du repo : `/favicon.png` était référencé dans
`index.html` mais absent de `public/` (onglet cassé en prod), et aucune
balise `og:image`/description n'existait (un lien BuildPact partagé sur
X/Discord n'affichait rien). Corrigé ce soir :

- `favicon.svg` (source de vérité, reprend exactement la géométrie/couleurs
  de `LogoMark` dans `DashboardLayout.tsx`) + PNG de repli (32/16px),
  `apple-touch-icon.png` (180px), `icon-512.png`, `site.webmanifest`.
- `og-image.png` (1200×630, généré directement — fond `#030308`, halos
  violet/neon/or comme les orbes de l'app, logo + wordmark + tagline),
  branché en `og:image`/`twitter:image`. ⚠️ URL utilisée :
  `buildpact-solana.vercel.app` (trouvée dans
  `BUILDPACT-RESUME-OFFICIEL-FR.md`) — **à revérifier une fois le nouveau
  repo/déploiement en place**, sinon la carte de partage pointe vers une
  URL obsolète.

Style retenu pour la suite (validé) : **vectoriel 2D flat premium** — pas
de 3D glossy (mal décliné en petit), pas de néon animé (un favicon ne peut
pas être animé), pas de meme (moins crédible pour un pitch investisseurs).
Cohérent avec `LogoMark` et `SeekerNexusBadge` déjà en place (SVG plats,
géométrie simple).

**Reste à faire, dans cet ordre validé :**
1. ✅ Favicon + méta réseaux sociaux — fait ce soir.
2. Refonte du set d'icônes : l'app utilise aujourd'hui des emoji Unicode
   (📜🔥🎁🏁💰🤝➕🌱☀️🌙 etc.) dans les quêtes/badges/thème/chronique — à
   remplacer par des SVG custom cohérents avec le style validé (rendu
   inconsistant d'un OS à l'autre avec de l'emoji, pas premium pour une
   démo investisseurs).
3. Visuel hero/bannière pour la landing + supports de pitch/démo hackathon,
   même palette que `og-image.png`.


## 29/08 (nuit, retour utilisateur live) — 3 corrections après premier test réel

Remontées en testant l'app en conditions réelles (captures d'écran à l'appui).

### BUG CRITIQUE corrigé : réclamation de quête → "Message de signature invalide."

Cause exacte trouvée en comparant octet pour octet le message signé côté
client et la regex ancrée côté serveur : `quest-write` (jamais versionnée
dans le repo local jusqu'ici — corrigé en même temps, voir plus bas)
attendait `"reclamation de quete"` / `"Quete:"` **sans accents**, alors que
`src/lib/gamification.ts::claimQuestReward` construit le message signé
**avec** accents (`"réclamation de quête"` / `"Quête:"`). Exactement le
piège documenté dans `CERVEAU_PROMPT.md` règle n°1 : une regex ancrée qui
diverge d'un seul caractère casse l'action entière, silencieusement.
Corrigé (regex alignée sur le texte réellement signé) et redéployé
(`quest-write` v2). La fonction est maintenant aussi sauvegardée dans
`supabase/functions/quest-write/index.ts` — elle ne l'était pas, à la
différence des 7 autres fonctions du projet.

### Pop-ups illisibles en mode clair / fond "Solid"

`.glass-panel` (fond translucide ~5% d'alpha, pensé pour une carte posée
SUR une page déjà décorée par les orbes) rendait `ProfileSettingsModal` et
`QuestBoard` presque transparents dès qu'il y avait moins de décor derrière
(mode clair, fond "Solid"/"Grille") — combiné au voile `bg-black/70` de la
modale, résultat gris délavé, illisible. Nouvelle classe `.modal-surface`
(fond opaque sur `--canvas-800-rgb`, déjà theme-aware — Aurum/Atelier le
réécrivent aussi) appliquée aux deux pop-ups. `.glass-panel` reste
inchangée pour les cartes de page (Marketplace, Pacts, etc.), pas concernée
par ce problème.

### Sélecteurs thème/fond : aperçu avant activation

Cliquer une palette/mode ou un style de fond appliquait ET persistait
immédiatement — risqué en démo (un clic malheureux change le thème visible
par tout le monde à l'écran). Nouveau comportement : le clic pose un
**aperçu** (`ThemeContext.preview`/`previewSet`), appliqué en live sur toute
la page (y compris le fond, lu par `DashboardLayout` via
`preview?.background ?? background`) mais PAS ENCORE persisté. Une barre
apparaît dans les paramètres : "Annuler" (`cancelPreview`, revient à l'état
déjà validé) ou "Activer ce thème" (`confirmPreview`, applique les setters
réels — mêmes qu'avant, donc toujours persistés/synchronisables comme
précédemment). Fermer la modale sans valider annule automatiquement
l'aperçu. Indépendant du bouton "Enregistrer" existant, qui ne sert qu'à
synchroniser le thème vers le profil distant pour les autres appareils.

Profité de ce chantier pour remplacer les mini-icônes emoji des deux
sélecteurs par de vrais mini-aperçus visuels : `ThemeModeGrid` montre
maintenant une bande d'accent + un corps couleur canevas (palette × mode
réellement visibles, pas juste nommés), `BackgroundSwitch` rend une
miniature CSS approximant le VRAI motif de chaque style (orbes, grille,
uni, aurore, scanlines) au lieu d'un pictogramme générique.

**Vérification** : `tsc --noEmit` complet — 0 erreur sur tous les fichiers
touchés (`ThemeContext.tsx`, `DashboardLayout.tsx`, `ThemeModeGrid.tsx`,
`BackgroundSwitch.tsx`, `ProfileSettingsModal.tsx`, `QuestBoard.tsx`). FR/EN
: 756/756 clés, 0 écart.


## 29/08 (nuit) — Nexus : assistant Solana/Web3 embarqué (module autonome, désactivé par défaut)

Nouveau module, entièrement découplé du reste de l'app — aucune autre
fonction/table/composant du projet n'en dépend, et lui n'en lit ni n'en
écrit aucun. Désactivé par défaut (`VITE_ASSISTANT_ENABLED=false` dans
`.env`) : n'apparaît que si on l'active explicitement.

**Modèle BYOK (Bring Your Own Key) — décision explicite de l'utilisateur.**
BuildPact ne paie aucun appel IA et ne fournit aucune clé. Chaque
utilisateur colle SA PROPRE clé (Anthropic, ou tout endpoint compatible
OpenAI — OpenAI, Groq, DeepSeek, OpenRouter…) dans les réglages du widget.
La clé est stockée UNIQUEMENT dans le `localStorage` du navigateur, jamais
envoyée à Supabase ni synchronisée avec le profil. Nouvelle Edge Function
`assistant-chat` (relais sans état : reçoit la clé à chaque appel, la
transmet au fournisseur, ne la persiste ni ne la journalise jamais) —
deux adaptateurs : API Messages Anthropic, et Chat Completions pour tout
ce qui est compatible OpenAI.

**Cadrage légal — décision explicite de l'utilisateur.** Le volet
"loi/réglementation" est strictement général et éducatif : le prompt
système interdit tout conseil juridique ou financier personnalisé et
impose un rappel de portée dès que le sujet l'exige. Choix motivé par un
risque réel (exercice non autorisé du droit selon les juridictions, la
réglementation crypto variant énormément d'un pays à l'autre).

**Architecture pensée pour le futur clone mobile Android** (roadmap Seeker
mobile) : la même Edge Function sert les deux — seule une enveloppe React
Native restera à écrire, aucune nouvelle logique serveur.

Fichiers : `supabase/functions/assistant-chat/index.ts` (nouveau),
`src/lib/assistant.ts` (nouveau — config BYOK, appel réseau),
`src/components/AssistantChat.tsx` (nouveau — bulle flottante + panneau,
réglages intégrés, aucun rendu si le flag est désactivé), monté une seule
fois dans `DashboardLayout.tsx`.

**Vérification** : `tsc --noEmit` — 0 erreur sur les fichiers touchés.
FR/EN : 778/778 clés, 0 écart.


## 30/08 (soir) — Passe UX/qualité : vue liste/grille/vignettes, soldes wallet, quêtes/XP V3, réglages

Session de fond sur les frictions d'usage remontées après les tests réels
des jours précédents, plus une demande produit répétée sur plusieurs
sessions avant d'être enfin livrée (vue liste/grille).

### Vue liste/grille/vignettes sur Pacts et Marketplace

Demandé plusieurs fois ("afficher en petite vignette ou en grande ou en
large, combien par page 12/30 ?, tri par catégorie/date, recherche par
rôle"). Nouveau `lib/viewMode.ts` + `hooks/useViewMode.ts` — 3 états
(liste/grille/vignettes), préférence de navigateur **partagée** entre
`/pacts` et `/marketplace` (même clé localStorage `buildpact_view_mode`,
volontaire : c'est une préférence de lecture, pas une config par page).
Nouveau `components/ViewModeSwitch.tsx` (3 boutons icône) et
`components/PactTile.tsx` (card compacte réutilisée par les deux pages en
grille/vignettes — bannière, titre, statut, vault, membres, simple lien
vers la fiche publique, aucune action on-chain — la vue liste garde
`PactCard`/`MarketplaceCard` complets, actions incluses).

- **Pacts** : mode liste = comportement d'origine inchangé, pas de
  pagination (les cards détaillées suffisent à s'orienter). Grille/
  vignettes = pagination 12/30/60 (clé `buildpact_pacts_per_page`), tri
  (défaut/plus récents/nom/statut), recherche libre (nom OU rôle
  recherché, via `useOpenRoles`).
- **Marketplace** : réutilise la pagination/tri/filtres déjà existants
  (rien de nouveau à construire côté données), juste le switch de rendu
  entre `MarketplaceCard` et `PactTile`. `fallbackBannerStyle` exporté
  depuis `MarketplaceCard.tsx` pour un dégradé de secours cohérent entre
  les deux composants.

### Soldes multi-tokens du wallet (lecture seule)

Nouveau `lib/tokenBalances.ts` — lit TOUS les comptes SPL réellement
détenus par le wallet connecté (`getParsedTokenAccountsByOwner`),
volontairement **agnostique** plutôt qu'une liste de mints à deviner :
USDC devnet étiqueté via son mint officiel Circle vérifié
(`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`), SKR/SKG lus dynamiquement
depuis l'env (pas encore déployés), tout autre token détenu s'affiche
générique (mint tronqué) — jamais caché, jamais mal étiqueté. Explicitement
pas d'USDT (aucun mint devnet officiel documenté trouvé) ni d'ETH/BTC
pontés (aucun mint Wormhole devnet stable identifié avec confiance) : pas
de fabrication d'adresse plutôt qu'un risque de mauvais étiquetage.

**Ce qui n'est PAS fait, volontairement** : payer/financer un pact avec
ces tokens. Ça demande de nouvelles instructions Anchor (vault en SPL
Token, `transfer_checked`, cf. `MULTI_TOKEN_FUNDING_PLAN.md`) — un
chantier qui touche au programme, refusé sans GO explicite (règle absolue
du projet). Confirmé avec l'utilisateur : **c'est NOAH qui gère les
évolutions du Program ID**, le frontend sera câblé une fois ce travail
fait côté programme.

### Journal de quêtes V3 (suite) + XpBar animée

- Icônes pleines dédiées aux badges de quête (`IconFundFilled`/
  `IconApproveFilled`/`IconFinalizeFilled`, `QuestIcons.tsx`) + flash
  "déblocage" (`quest-badge-unlock` / `@keyframes quest-unlock-flash`) au
  moment précis où une quête passe "en cours" → "prête à réclamer".
- `XpBar.tsx` : compteur XP qui défile (easeOutCubic ~600ms) au lieu de
  sauter, reflet en boucle continue sur la barre (`xpbar-shimmer`), flash
  + éclat de particules (réutilise `ClaimBurst`) au changement de rang
  détecté entre deux fetch. Les trois neutralisés sous
  `prefers-reduced-motion` — découvert en testant que l'utilisateur a ce
  réglage actif sur sa machine, donc invisible pour lui en usage normal,
  par design (accessibilité), pas un bug.

### Bugs corrigés

- **Hydratation React (`BuildersPage.tsx`)** : la carte cliquable "Voir la
  fiche complète" était un `<button>` contenant `<StarRating>` (qui rend
  elle-même des `<button>` par étoile) — bouton dans bouton, HTML
  invalide. Remplacé par `<div role="button" tabIndex={0}>` +
  `onKeyDown` Entrée/Espace.
- **`InfoTooltip` coupé dans les panneaux scrollables** : la bulle était
  `absolute` dans son propre conteneur, donc rognée net dans tout panneau
  `overflow-y-auto` (`ProfileSettingsModal` notamment) — souvent invisible
  sur les réglages en bas de liste. Réécrit en portail sur `<body>`,
  `position: fixed`, positionné via `getBoundingClientRect()`.
- **`InfoTooltip` se refermait trop vite** : fermeture instantanée au
  `mouseleave` du petit rond de 16px, bulle en `pointer-events-none` donc
  impossible à atteindre pour la lire. Fix : délai de fermeture 250ms
  (annulé si le curseur revient sur le bouton OU entre sur la bulle
  elle-même, qui capte maintenant le survol). Vérifié par dispatch
  d'événements souris réels (`mouseover`/`mouseout` + `relatedTarget`)
  dans la console — le simulateur de survol de l'outil de contrôle du
  navigateur avait donné un faux négatif au premier essai (mouvement
  non-continu entre deux appels, pas un vrai bug de l'app).

### Réglages — nettoyage et lisibilité

- **"?" redondants retirés** partout où le texte explicatif est déjà
  affiché en permanence à côté du même contenu (`CsvExportButton`,
  `NotificationSettings`, `CustomRpcSettings`, `DensitySwitch`, palette
  d'accent et confidentialité dans `ProfileSettingsModal`). Gardés là où
  c'est la seule explication (`GlowStrengthSwitch`, `ImagePreviewSettings`,
  tooltips de Leaderboard/Marketplace).
- **Description RPC personnalisé enrichie** — répond explicitement à
  "c'est quoi / pour faire quoi / comment faire" plutôt qu'une phrase
  télégraphique.
- **Panneau des réglages en plein écran** — avant : boîte centrée
  `max-w-xl` (576px) avec toute la page visible autour. Maintenant :
  `h-[100dvh] w-full` sur mobile, `sm:h-[94vh] sm:w-[94vw] sm:max-w-3xl`
  sur desktop.
- **Aperçu grand format (logo/bannière)** : déclenchement au clic
  uniquement, le survol a été retiré — sur une grille dense il s'ouvrait
  au moindre passage de souris, gênait plus qu'il n'aidait.

**Vérification** : `tsc --noEmit` 0 erreur nouvelle sur tous les fichiers
touchés à chaque étape. FR/EN : 773/773 clés, 0 écart. Chaque changement
visuel testé en live via l'extension Chrome de l'utilisateur (localhost,
wallet réel connecté) — captures et vérifications console à chaque étape,
0 erreur.

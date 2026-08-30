# BuildPact — Cerveau / Prompt de reprise

> À coller en début de conversation avec un assistant IA pour qu'il reprenne
> le projet sans repartir de zéro. Contient le contexte minimal **et** les
> pièges qui font perdre des heures.
>
> Mise à jour 30/08 (soir) : passe UX/qualité complète — Journal de
> quêtes V3 (icônes pleines, flash de déblocage), XpBar animée (compteur,
> reflet, flash de rang), bug hydratation StarRating/BuildersPage corrigé,
> tooltips "?" réparés (portail `fixed`, ne sont plus coupés dans un
> panneau scrollable, ni ne se referment trop vite), "?" redondants
> retirés là où la description est déjà visible en permanence, panneau
> des réglages passé en plein écran, aperçu grand format = clic
> uniquement (survol retiré), description RPC personnalisé enrichie,
> **soldes multi-tokens en lecture seule dans le menu wallet** (USDC
> devnet + tout SPL détenu — voir ÉTAT CONNU pour ce qui n'est PAS fait :
> payer avec), et **vue liste/grille/vignettes + tri + recherche +
> pagination** sur Pacts ET Marketplace (préférence partagée entre les
> deux pages). Aucune ligne du prompt à copier n'a été retirée.

---

## Prompt à copier

```
Tu reprends BuildPact, une DApp Solana (devnet) qui formalise on-chain la
répartition des parts entre co-fondateurs d'un projet.

STACK
- React 19 + Vite 8 + TypeScript 5.5 + Tailwind 3.4 + framer-motion
- Anchor 0.31.1, program ID 9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ
- Supabase (Postgres + Edge Functions Deno), projet xkznmflyiilgmxhvgega
- Routing par HASH maison (src/lib/router.ts) — PAS de BrowserRouter
- i18n maison FR/EN (src/lib/i18n/), FR par défaut, 773 clés/langue

MODÈLE DE SÉCURITÉ — le point le plus important
Postgres ne peut pas savoir qui contrôle une clé Solana. Aucune table
n'accepte donc d'écriture publique : tout passe par une Edge Function qui
vérifie une signature ed25519 (ou une transaction on-chain), puis écrit en
service_role. Le champ « auteur » est TOUJOURS renseigné par le serveur à
partir de la signature vérifiée, jamais depuis un champ client.

Si tu ajoutes une écriture, tu dois passer par une Edge Function. Un
supabase.from(...).insert() depuis le navigateur échouera silencieusement.

RÈGLES À NE PAS ENFREINDRE
1. Les messages signés sont validés par des regex ANCRÉES côté serveur.
   Modifier un libellé (espace, accent, ordre des lignes) casse l'action.
   Constructeurs centralisés dans src/lib/projectWrite.ts.
2. Les bornes de texte du programme sont en OCTETS UTF-8, pas en caractères.
   Utiliser utf8ByteLength() de src/lib/textSafety.ts.
3. `creator` doit rester le PREMIER champ de la struct Project : trois Edge
   Functions le lisent aux octets 8..40 sans Anchor. Un réordonnancement
   casse tout silencieusement.
4. Ne pas ajouter de BrowserRouter.
5. Ne pas éditer src/components/ui/ (primitives shadcn).
6. Les variables CSS de thème (--accent-*-rgb, --canvas-*-rgb, --ink-*-rgb,
   --text-primary-rgb) prennent des CANAUX RGB SÉPARÉS ("153 69 255"),
   jamais un hex ni un rgb(...) complet — sinon les modificateurs
   d'opacité Tailwind (bg-accent-violet/20) s'ignorent silencieusement,
   sans erreur de build. Voir DOSSIER_TECHNIQUE.md §0.
7. Pour une POP-UP (modale), utiliser `.modal-surface` (fond opaque),
   jamais `.glass-panel` (~5% d'alpha, pensé pour une carte posée SUR la
   page décorée — illisible en mode clair ou fond "Solid"/"Grille" une
   fois isolé dans une modale). Vu en direct le 29/08 : ProfileSettingsModal
   et QuestBoard étaient presque transparents avant ce correctif.
8. Une regex ancrée côté serveur doit matcher le message client OCTET PRÈS
   (accents inclus) — la règle 1 existait déjà, elle a quand même fait
   échouer TOUTE réclamation de quête le 29/08 (`quest-write` écrit sans
   accents, `gamification.ts` signait avec). Avant de considérer une
   nouvelle fonction à message signé "terminée", diffuser le message
   exact des deux côtés, ne pas se fier à une relecture visuelle.

BLOQUANT UPGRADE — RÉSOLU le 29/08 (nuit), 4e vérification, cette fois
confirmée aux DEUX endroits qui comptent :
- `node scripts/keys-check.mjs` : `contracts/target/wallet/wallet.json`
  → `8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6` (autorité attendue),
  et l'autorité on-chain réelle confirme la même valeur.
- `solana address -k ~/.config/solana/id.json` (le fichier qu'Anchor
  utilise RÉELLEMENT pour `anchor upgrade`, via `[provider] wallet` dans
  `Anchor.toml` — le script keys-check.mjs ne le vérifie PAS, il faut
  cette commande séparée) → même valeur, confirmée par l'utilisateur en
  direct.
- `contracts/target/wallet/id.json` et `workspace-keypair.json` restent
  "faux"/absents mais SANS IMPORTANCE : le premier est une copie inutilisée,
  le second est la clé du PROGRAMME (pas l'autorité) et ne sert qu'au tout
  premier déploiement.
- **Historique à ne pas oublier** : cette clé a déjà été signalée
  « corrigée » trois fois lors de sessions précédentes (28/08, 29/08
  après-midi, 29/08 nuit avant cette vérification) et s'est retrouvée
  fausse à nouveau à chaque fois — vraisemblablement une resynchronisation
  Noah qui réécrit `wallet.json` avec un état antérieur. **Ne jamais faire
  confiance à un statut « déjà corrigé » sur ce fichier sans relancer les
  DEUX vérifications ci-dessus juste avant un `anchor upgrade` réel** —
  la vérification du 29/08 nuit ne garantit pas que ça tiendra à la
  prochaine session.
- Un `anchor upgrade` du multi-token funding (ou toute autre instruction
  future, ex. `fund_spl`/`distribute_spl` — voir MULTI_TOKEN_FUNDING_PLAN.md,
  encore au stade proposition, pas de GO donné) n'est donc plus bloqué par
  les clés — reste bloqué uniquement par l'absence de GO utilisateur sur le
  contenu de l'upgrade lui-même.

ÉTAT CONNU
- lib.rs, src/idl/buildpact.json et src/lib/onchainLimits.ts sont cohérents
  entre eux : build du 27/08, bornes 80/500/32, update_description présente.
  Mais ces trois fichiers sont dans le dépôt et ne prouvent pas ce qui est
  DÉPLOYÉ. Lancer `node scripts/idl-check.mjs` pour trancher (simulation, ni
  clé privée ni transaction). Ne pas basculer PROGRAM_UPGRADED à l'aveugle.
- Le bucket de stockage des médias de projet n'est pas encore verrouillé
  (priorité 2 de FEUILLE_DE_ROUTE.md). Le bucket du fil social, lui, passe
  déjà par network-write.
- Systèmes hors-chaîne ajoutés le 28-29/08, AUCUN ne touche au programme
  (ni Program ID, ni Config PDA) : (1) thème à deux axes indépendants —
  palette d'accent (violet/cyan/coral/aurum/atelier) ET mode clair/sombre,
  plus une échelle d'élévation (--surface-1/2/3) et un curseur d'intensité
  de halo (--glow-strength) ; (2) gamification — XP en ledger append-only
  (xp_events), rangs, badges (rareté + progression), quêtes hebdomadaires
  V2 (réclamation cliquée, streak, bonus de complétion, chronique),
  classement sur /leaderboard ; (3) fil social builders sur /network
  (network-write). Détail : RESUME_PROJET.md §4-5, DOSSIER_TECHNIQUE.md
  §0 et §12, FEUILLE_DE_ROUTE.md section « 29/08 (nuit) ».
- Bug corrigé le 29/08 (nuit) : `pact_events.kind_chk` n'acceptait pas le
  kind `'create'` depuis toujours — aucune création de pact n'avait jamais
  compté pour l'XP ni les badges serialFounder/firstMover. Corrigé, MAIS
  **non rétroactif** : aucun wallet n'a été recrédité pour ses créations
  passées.
- `MULTI_TOKEN_FUNDING_PLAN.md` (racine du dossier) : proposition détaillée
  pour financer en USDC/USDT/BTC-ETH pontés, AUCUNE ligne de programme
  écrite, en attente de validation humaine avant tout code — c'est le
  candidat le plus concret à bundler dans le prochain `anchor upgrade`
  (voir « BLOQUANT UPGRADE » plus haut) si le GO est donné.
- Identité visuelle démarrée le 29/08 (nuit) : `favicon.png` était
  référencé dans `index.html` mais absent de `public/` (onglet cassé en
  prod), aucune balise `og:image`/description non plus — les deux
  corrigés. Style verrouillé (choix utilisateur) : **vectoriel 2D flat
  premium** — pas de 3D glossy, pas de néon animé, pas de meme. Reste à
  faire : remplacer les emoji Unicode utilisés partout (quêtes, badges,
  thème) par des icônes SVG custom, puis un visuel hero/bannière pour la
  landing et le pitch hackathon. `og:url`/`og:image` pointent vers
  `buildpact-solana.vercel.app` (trouvé dans un doc existant) — à
  revérifier une fois le nouveau repo/déploiement en place.
- Trois corrections issues d'un premier test réel de la Quest V2/Thème V2
  (29/08 nuit) : (1) réclamation de quête qui échouait toujours — voir
  règle 8 ci-dessus ; (2) pop-ups illisibles en mode clair/fond "Solid" —
  voir règle 7 ; (3) les sélecteurs palette/mode/fond appliquaient ET
  persistaient instantanément au clic — remplacé par un aperçu live
  (`ThemeContext.preview`/`previewSet`) + une barre "Annuler"/"Activer ce
  thème" (`cancelPreview`/`confirmPreview`) dans `ProfileSettingsModal`.
  Tout consommateur qui a besoin de la valeur RÉELLEMENT affichée (pas
  seulement validée) doit calculer `preview?.x ?? x` lui-même — le
  contexte n'écrase pas silencieusement ses propres champs validés.
- **Nexus** (nouveau module, 29/08 nuit) : bulle de chat flottante,
  assistant Solana/Web3 — **désactivé par défaut**
  (`VITE_ASSISTANT_ENABLED=false` dans `.env`). Architecture BYOK
  (Bring Your Own Key) explicitement choisie par l'utilisateur : chaque
  personne fournit SA PROPRE clé (Anthropic, ou tout endpoint compatible
  OpenAI), stockée uniquement dans son `localStorage`, jamais par
  BuildPact — nouvelle Edge Function `assistant-chat` relaie sans jamais
  persister la clé. Volet "loi/réglementation" strictement général et
  éducatif (choix utilisateur explicite, jamais de conseil personnalisé —
  risque réel d'exercice non autorisé du droit sinon). Module 100%
  autonome : aucune autre partie du projet n'en dépend, retirable sans
  rien casser. Pensé pour être réutilisé tel quel par un futur clone
  mobile Android (même Edge Function, juste une autre enveloppe UI).

- **Soldes multi-tokens du wallet (30/08, lecture seule)** —
  `lib/tokenBalances.ts` : lit TOUS les comptes SPL réellement détenus
  par le wallet connecté (`getParsedTokenAccountsByOwner`, agnostique,
  pas de liste figée de mints à deviner). USDC devnet étiqueté via son
  mint officiel Circle vérifié
  (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). SKR/SKG lus
  dynamiquement depuis `VITE_SKR_TOKEN_MINT`/`VITE_SKG_TOKEN_MINT` (pas
  encore renseignés — tokens pas déployés). **Ce n'est QUE de la
  lecture** : payer/financer un pact avec ces tokens demanderait de
  nouvelles instructions Anchor (vault en SPL Token, pas seulement SOL
  natif) — gros chantier qui touche au programme, PAS fait, en attente
  d'un GO explicite. **C'est NOAH qui gère les ajouts côté Program ID
  Solana**, pas l'assistant qui reprend ce prompt — ne pas modifier
  lib.rs/Program ID/Config PDA sans que ce soit passé par ce canal.
- **Vue liste/grille/vignettes (30/08)** — `lib/viewMode.ts` +
  `hooks/useViewMode.ts`, préférence de navigateur PARTAGÉE entre Pacts
  et Marketplace (même clé localStorage `buildpact_view_mode`, volontaire
  — c'est une préférence de lecture, pas une config par page). Mode liste
  = cards détaillées inchangées (`PactCard`/`MarketplaceCard`, actions
  on-chain incluses) ; grille/vignettes = nouveau `components/
  PactTile.tsx` (léger, simple lien vers la fiche, aucune action) +
  pagination/tri/recherche. Si tu ajoutes un champ à `ChainPact` affiché
  en liste, vérifie s'il vaut aussi la peine d'apparaître dans PactTile —
  sinon il disparaît silencieusement en vue dense.
- **InfoTooltip = portail `position: fixed` (30/08)**, plus un `absolute`
  dans son propre conteneur — sinon coupé net dans tout panneau
  `overflow-y-auto` (bug réel trouvé sur ProfileSettingsModal). Ferme
  avec un délai de 250ms (annulable en survolant la bulle elle-même, qui
  capte maintenant le survol) — sans ce délai la bulle se referme avant
  qu'on ait eu le temps de la lire. Ne PAS ajouter un `<InfoTooltip>` à
  côté d'un texte déjà affiché en permanence avec le même contenu — c'est
  exactement le doublon qui vient d'être nettoyé sur plusieurs réglages.

DOCUMENTS
- RESUME_PROJET.md      — vue d'ensemble produit + technique
- DOSSIER_TECHNIQUE.md  — décisions d'archi et leurs contreparties
- FEUILLE_DE_ROUTE.md   — priorités par risque décroissant

Avant de proposer du code, lis le document pertinent. Signale-moi les
contreparties d'une approche plutôt que de choisir à ma place.
```

---

## Contexte complémentaire (à fournir au besoin)

### Les compromis déjà tranchés — ne pas les rejouer sans raison

**Sessions de chat de 24 h plutôt qu'une signature par message.**
Un popup wallet par message rend un chat inutilisable. Le jeton est un
*bearer token* en `localStorage` : c'est assumé, borné par le scope projet,
un rate limit de 10 msg/min et une révocation serveur.

**Révocation par *cutoff* daté plutôt que par liste de jetons.**
Celui qui révoque est sur un autre appareil que celui compromis : il n'a pas
le jeton à blacklister. Un cutoff couvre les jetons inconnus. Bonus : une
ligne par wallet, la table ne grossit pas.

**Tolérance de 60 s sur le cutoff.**
Sans elle, une horloge locale qui retarde produit une boucle de popups sans
issue. Le prix : un jeton volé signé dans la minute précédant la révocation
survit.

**Journal d'activité vérifié par transaction, sans signature.**
Il s'écrit juste après une transaction confirmée ; un second popup y serait
insupportable. Vérifier la transaction est de toute façon plus fort que
vérifier l'identité. La même mécanique sert de porte d'entrée à l'XP.

**Médias : une seule signature pour tous les champs.**
Uploads d'abord (sans signature), puis un unique appel signé. Sinon une
sauvegarde coûte jusqu'à quatre popups.

**Mode clair/sombre additif, pas un remplacement de la palette.**
Deux attributs indépendants sur `<html>` (`data-theme` pour la palette,
`data-mode` pour clair/sombre) plutôt qu'un seul système à refondre. Glows,
orbes et `grid-bg` restent volontairement calés sur le rendu sombre dans les
deux modes — retravailler l'identité visuelle néon n'était pas le besoin
exprimé.

### Modes de panne silencieux

Ce projet a plusieurs façons de tomber en panne **sans afficher d'erreur**.
Les connaître fait gagner beaucoup de temps :

| Ce qu'on observe | Cause réelle |
|---|---|
| Aucune donnée sociale, aucune erreur | Variables Supabase absentes de `.env` |
| Variable ajoutée, toujours rien | Vite ne relit `.env` qu'au démarrage |
| Une écriture disparaît sans message | Insert direct sur une table verrouillée par RLS |
| IDL et code d'accord, mais ça échoue | L'IDL décrit un binaire qui n'est pas déployé |
| « Seul le founder… » adressé au founder | Ordre des champs de `Project` modifié |
| Erreur 6005 au moment de signer | Bornes du front > bornes du programme déployé |
| Tout le texte devient illisible en mode clair | Une couleur pointe vers `--ink-900-rgb` au lieu de `--text-primary-rgb` — la première est identique dans les deux modes par design |
| Un fichier/composant « livré » a disparu du disque | Resynchronisation Noah ↔ dépôt local qui a réécrit un état plus ancien — vérifier le disque avant de construire dessus, ne pas se fier à un statut « fait » d'une session antérieure |
| Une pop-up est quasi transparente, illisible en mode clair | `.glass-panel` utilisé au lieu de `.modal-surface` — la première est pensée pour une carte sur page décorée, pas une modale |
| Une réclamation/action signée échoue avec "signature invalide" sans autre détail | Le message signé côté client et la regex ancrée côté serveur divergent d'un accent ou d'un espace — diff byte-à-byte, ne pas relire à l'œil |

### Ton attendu

Le code de ce projet est abondamment commenté, et pas en paraphrase : les
commentaires expliquent **pourquoi** une décision a été prise et **ce qu'elle
coûte**. Les rubriques « ⚠️ » signalent ce qui casse silencieusement si on
l'ignore. Conserver cette convention — c'est ce qui rend le projet reprenable.

Signaler les contreparties plutôt que de survendre une solution. Quand deux
approches se valent, nommer ce que chacune optimise et laisser choisir.

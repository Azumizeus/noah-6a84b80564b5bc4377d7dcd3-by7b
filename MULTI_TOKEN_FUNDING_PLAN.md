# BuildPact — Spec : financement multi-devises (USDC/USDT/BTC/ETH)

> Statut : PROPOSITION — aucune ligne de programme écrite. À valider avant tout code, conformément à la règle « avant toute modif destructrice : annoncer + attendre GO ».
> Dernière mise à jour : 29 août 2026

---

## 0. Ce qui existe aujourd'hui (vérifié dans `lib.rs`, pas supposé)

Le programme ne connaît que le SOL natif, de bout en bout :

- `fund(amount_lamports: u64)` — crédite le vault en lamports via `system_program::transfer`.
- Le vault (PDA `["vault", project]`) est un compte **système**, pas un compte de token. Il ne peut détenir que du SOL.
- `distribute()` calcule un seul pot (`vault.lamports() - rent_min`), prélève 2 % (`PROTOCOL_FEE_BPS`), répartit le reste entre les membres au prorata de `share_bps`, et transfère via `system_program::transfer` — une primitive qui ne sait déplacer que des lamports, jamais un token SPL.
- `Project.members[].share_bps` est une seule liste de parts, pas une par devise.

Conséquence directe : ajouter USDC/USDT/BTC/ETH n'est pas un réglage d'interface. Ce sont deux primitives différentes (`system_program::transfer` vs `anchor_spl::token::transfer_checked`) et une structure de compte différente (compte système vs compte de token associé).

---

## 1. Ce que « USDC/USDT » veut dire techniquement

USDC et USDT sur Solana sont des **tokens SPL** — des comptes, pas des soldes natifs. Détenir 100 USDC signifie posséder un *Associated Token Account* (ATA) dont le solde interne vaut 100 × 10⁶ (6 décimales, pas 9 comme le SOL). Le programme aurait besoin de :

- Un **vault par mint**, pas un vault unique. Proposition de seeds canoniques (cohérent avec la règle existante « PDA seeds canonical ») :
  `["token_vault", project, mint]` → une ATA possédée par ce PDA.
- Une nouvelle instruction `fund_spl(amount)` avec les comptes `funder_ata`, `vault_ata`, `mint`, `token_program` — CPI `transfer_checked` (jamais `transfer` simple : `transfer_checked` vérifie que `mint` et `decimals` correspondent, ce qui bloque une classe entière d'erreurs si un funder se trompe de token).
- Une instruction `distribute_spl(mint)` qui reproduit la logique de `distribute()` mais avec `anchor_spl::token::transfer_checked` et des ATA en `remaining_accounts` au lieu de wallets bruts. Un membre sans ATA pour ce mint ne peut pas recevoir sa part tant qu'elle n'existe pas — il faut décider **qui paie la création de cette ATA** (le membre, le creator au moment de `distribute`, ou le protocole).

## 2. Ce que « BTC/ETH » veut dire techniquement — et où ça diffère vraiment

Le programme Solana ne peut jamais détenir de BTC ou d'ETH réels : ce sont des actifs d'une autre chaîne. La seule façon de les représenter ici est une version **pontée** (ex. Wormhole-wrapped BTC/ETH), qui redevient, une fois sur Solana, un token SPL comme un autre — même mint address fixe, même primitive `transfer_checked`.

Donc côté programme, BTC/ETH pontés = zéro travail supplémentaire par rapport à USDC/USDT : c'est le même `fund_spl`/`distribute_spl` générique, paramétré par un `mint` différent. Toute la complexité additionnelle est **hors du programme** :

- L'utilisateur doit déjà détenir le wrapped token avant d'arriver sur BuildPact — le protocole ne fait pas le pont lui-même (risque de custody et de UX qu'on ne maîtrise pas).
- Le prix affiché à l'écran (si on veut montrer un équivalent USD) demande un oracle — `pyth-skill` est déjà listé dans les skills du projet, à mobiliser seulement si on affiche une conversion, jamais pour calculer une répartition (les `share_bps` s'appliquent au pot réel du mint, pas à une valeur convertie qui bougerait entre le fund et le distribute).

## 3. Décision de modèle à trancher avant tout code

**Un projet peut-il être financé dans plusieurs devises à la fois, ou une seule par pact ?**

| Option | Implication |
|---|---|
| A. Une devise choisie à la création du pact | Plus simple à afficher (« Ce pact lève des USDC »), mais rigide — un founder qui voulait du SOL ne peut pas accepter un backer en USDC. |
| B. Plusieurs vaults simultanés par pact (un par mint réellement funded) | Plus flexible, mais chaque devise devient un pot indépendant : les `share_bps` s'appliquent séparément à *chaque* pot. Un membre à 25 % touche 25 % du pot SOL **et** 25 % du pot USDC, distribués par deux appels séparés à `distribute`/`distribute_spl`. Ça doit être explicite dans l'interface, sinon un backer croira avoir financé un seul pot mixte. |

Recommandation : **B**, parce que l'option A oblige à choisir une devise dès la création, avant même de savoir ce que les backers voudront utiliser — ce qui va à l'encontre du principe actuel (le founder fixe les rôles/parts, les backers financent après coup, sans négociation supplémentaire).

## 4. Séquencement proposé

1. **USDC seul.** C'est la paire que les devs/backers détiennent déjà le plus souvent sur devnet ; ça valide `fund_spl`/`distribute_spl` sur un seul mint avant de généraliser.
2. **USDT** — même code, juste un second mint autorisé. Quasi gratuit une fois (1) fait.
3. **BTC/ETH pontés** — seulement si une vraie demande apparaît. Ajoute une étape de compréhension utilisateur (« pourquoi je dois d'abord passer par un pont ») sans ajouter de valeur technique propre au programme.

## 5. Ce qui ne change pas

- Program ID et Config PDA (`protocol_fee_bps = 200`, `protocol_wallet`) : inchangés, réutilisés tels quels par `distribute_spl`.
- `finalize()`/`approve()`/`add_member()` : aucun impact, ils ne touchent pas au vault.
- Devnet uniquement, comme le reste du projet — les mints USDC/USDT devnet ne sont pas les mêmes adresses que mainnet, à fixer dans `constants.ts` le moment venu, jamais en dur dans le programme.

## 6. Risques à nommer maintenant, pas après coup

- **Rent des ATA.** Chaque nouveau (membre × mint) financé nécessite une ATA si elle n'existe pas — quelques centimes de SOL à chaque fois, mais quelqu'un doit les payer. À trancher au moment du design du flow `distribute_spl`.
- **Surface d'audit doublée par mint actif.** Chaque nouvelle devise est un nouveau chemin `fund_x`/`distribute_x` à auditer avec le même sérieux que le chemin SOL actuel (PDA seeds canonical, signer checks, arithmétique checked) — pas un copier-coller qu'on suppose sûr parce que le premier l'était.
- **Comptes à réauditer un par un**, pas parce que le motif de copier-coller serait dangereux en soi.

## 7. Ce que je n'ai pas les moyens de vérifier depuis ici

Je n'ai pas cherché les adresses de mints USDC/USDT sur devnet — elles doivent être confirmées avant toute implémentation (une fausse adresse de mint dans `constants.ts` romprait `transfer_checked` silencieusement côté decimals si le mint choisi n'a pas 6 décimales).

---

**Ce document ne modifie aucun fichier de code.** La prochaine étape, si tu valides l'option B et le séquencement USDC → USDT → BTC/ETH, est d'écrire l'instruction `fund_spl` et sa suite de tests (LiteSVM, comme le reste du programme) avant de toucher au frontend.

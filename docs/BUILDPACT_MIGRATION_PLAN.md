# BuildPact — Plan de migration

> Dernière mise à jour : 28 août 2026
> La version du 27/08 — 710 lignes, rédigée avant l'import du code — est
> archivée dans `docs/archive/BUILDPACT_MIGRATION_PLAN_2708.md`. Elle reste
> utile : elle contient les arbitrages détaillés (pourquoi 500 octets et pas
> 2000, pourquoi `protocol_wallet` est conservé, pourquoi `revoke_approval`
> a été écarté) que ce document ne fait que résumer.

**Program ID :** `9quyDwntXDBhNhTmrfCf7xEXVFaxYMB83BwPEUeqVoUJ` — inchangé
**Réseau :** devnet · **Anchor :** 0.31.1
**Protocol wallet :** `AVhVM29hD6YRLb2DujhKfF8Ger4bgaCpx9P93Q3XBWSH` · **Fee :** 200 bps
**Upgrade authority :** `8eui3v5xoSwoGHeLXrYQv7TMfvY2hSrJeBoHCFQzB4j6`

---

## 1. Où en est la migration

| Phase | Objet | Statut |
|---|---|---|
| 0 | Comparer IDL on-chain / local | **Ouverte** — jamais exécutée, voir §2 |
| 0 bis | Retrouver l'autorité d'upgrade | **Close** (27/08) |
| 1 | Import du frontend et des Edge Functions | **Close** |
| 2 | Audit de cohérence frontend ↔ programme | **Close** |
| 2 bis | Bornes 280→500 / 40→80 / 24→32 + `update_description` | **Code et IDL faits ; upgrade annoncé le 28/08, non revérifié** |
| 2 ter | Nettoyage `Cargo.toml` / `Anchor.toml` | **Close** (27/08) |
| 3 | Frontend | **Close, et largement dépassée** |
| 4 | Backend Supabase | **Close, et dépassée** |
| 5 | Propagation de l'IDL vers les 3 destinations | **Faite** |

Ce qui a été livré au-delà du plan initial : marketplace, annuaire de
builders, candidatures aux rôles ouverts, chat par projet, profils, médias de
projet, page trésorerie avec export, fil d'activité, i18n FR/EN, QR codes.

Le plan prévoyait 2 Edge Functions (`vault`, `open-roles`). Il y en a **6** :
s'ajoutent `chat-moderate`, `contact`, `project-write`, `update-profile`.

---

## 2. Le seul point encore ouvert

`programs/workspace/src/lib.rs`, `src/idl/buildpact.json` et
`PROGRAM_UPGRADED = true` dans `src/lib/onchainLimits.ts` sont **cohérents
entre eux** : bornes 80 / 500 / 32, `update_description` présente, événement
`DescriptionUpdated` présent.

Cette cohérence ne prouve rien sur le binaire déployé. Les trois fichiers
vivent dans le dépôt : ils peuvent être parfaitement d'accord et décrire une
version qui n'est pas en ligne. Le champ `address` d'un IDL est déclaratif,
`PROGRAM_UPGRADED` est un booléen écrit à la main, et le commentaire
documentant l'upgrade du 28/08 (signature `67Vmcg4F6Fg…NB8ufam`) n'est qu'un
commentaire.

C'est la « divergence silencieuse » du §6, transposée aux bornes. Si le
binaire en ligne était resté l'ancien, deux symptômes suivraient :

- `MigratePactButton` appellerait une instruction inconnue du dispatcher ;
- plus fréquent et plus pénible : l'utilisateur rédigerait jusqu'à 500 octets
  de description, puis échouerait en `InvalidParameter` (6005) **au moment de
  signer** — après avoir tout écrit.

**Vérification :**

```bash
node scripts/idl-check.mjs          # VERBOSE=1 pour les logs de simulation
```

Le script décode un compte `Project` au statut Open, en extrait le vrai
`creator`, et simule deux appels `update_description` sans clé privée ni
transaction envoyée :

| Sonde | Réponse | Conclusion |
|---|---|---|
| 1 octet | `InstructionFallbackNotFound` (101) | instruction absente → ancien binaire |
| 400 octets | `InvalidParameter` (6005) | borne en ligne < 400, donc encore 280 |
| 400 octets | acceptés | borne en ligne = 500, tout est aligné |

La seconde sonde est celle qui compte : elle **mesure** la borne au lieu de
la déduire de la présence d'une instruction. 400 est choisi strictement entre
l'ancienne valeur (280) et la nouvelle (500), ce qui rend le test
discriminant.

**Selon le verdict :**

- cohérent → rien à faire, noter la date de vérification ici ;
- le front autorise plus que le programme → `PROGRAM_UPGRADED = false`
  **immédiatement**, puis planifier l'upgrade. Seul cas dangereux ;
- le programme accepte plus que le front → sans risque, basculer à `true`
  quand on veut.

Ne pas basculer le drapeau à l'aveugle dans un sens ou dans l'autre.

---

## 3. Rappel des décisions on-chain

Détail complet et justifications dans l'archive du 27/08. Ce qui doit rester
présent à l'esprit :

| Décision | Raison courte |
|---|---|
| `MAX_DESC_LEN = 500` (et pas 2000) | Une transaction Solana est plafonnée à **1232 octets**. Au-delà de ~800, on paierait du rent sur de l'espace physiquement inatteignable |
| `MAX_TITLE_LEN = 80`, `MAX_ROLE_LEN = 32` | Embarqués dans la même fenêtre d'upgrade ; les refaire plus tard coûterait un redéploiement entier |
| `MAX_PROJECT_ID_LEN = 20` inchangé | Seed de PDA, plafonnée à 32 octets par Solana |
| `MAX_MEMBERS = 8` inchangé | Chaque membre ajoute un CPI dans `distribute` |
| `update_description` avec `realloc` | Sert aussi d'instruction de **migration** : porte un ancien compte à `Project::LEN`, ce qui débloque simultanément description, titre et rôles longs |
| `protocol_wallet` conservé dans `create_project` | Le retirer changerait la signature → IDL modifié → fenêtre de panne où toute création échoue |
| `revoke_approval` / `update_member_share` écartés | Ouvriraient la modification de parts déjà approuvées. Sortie de secours existante : `close_project` puis recréation |
| Nouveaux codes d'erreur en fin d'enum uniquement (≥ 6023) | Anchor numérote dans l'ordre de déclaration ; une insertion décale tout, silencieusement |

Deux pièges qui reviennent constamment :

- **Ces bornes sont en OCTETS UTF-8, pas en caractères.** Un « é » vaut 2, un
  emoji jusqu'à 4. 500 octets = ~440 caractères en français accentué, ~125 en
  emojis. Toujours mesurer avec `utf8ByteLength()` de `src/lib/textSafety.ts`.
- **Le pact solo est une impasse.** `finalize` exige au moins 2 membres, et
  aucune instruction ne réduit la part d'un membre inscrit. Un créateur à
  10000 bps est bloqué. Ce n'est pas une perte de fonds (le vault est vide
  tant que le pact est Open, `close_project` rend le rent), mais l'UI doit le
  signaler **avant** la signature.

---

## 4. Procédure pour un futur upgrade

L'ordre est contraignant : inverser deux étapes crée une fenêtre pendant
laquelle le front appelle un programme qui ne correspond plus.

```bash
anchor build
anchor keys list        # DOIT afficher 9quyDwnt… — sinon le keypair a été régénéré
solana program deploy target/deploy/workspace.so \
  --program-id target/deploy/workspace-keypair.json \
  --upgrade-authority ~/.config/solana/id.json \
  --url devnet
```

Puis, dans le **même commit** :

1. copier `target/idl/workspace.json` vers les **3** destinations :
   - `src/idl/buildpact.json`
   - `supabase/functions/vault/buildpact_idl.json`
   - `supabase/functions/open-roles/buildpact_idl.json`
2. ajuster `PROGRAM_UPGRADED` dans `src/lib/onchainLimits.ts`
3. `supabase functions deploy vault && supabase functions deploy open-roles`
   — un `git push` ne redéploie **pas** les Edge Functions
4. `node scripts/idl-check.mjs` pour confirmer, puis test end-to-end sur un
   **ancien** pact : `add_member`, `approve`, `fund`, `distribute`

Ce dernier test est celui qui valide réellement la rétrocompatibilité, et
c'est aussi celui qu'on saute quand tout a l'air de marcher.

Si `deploy` renvoie `account data too small` :
`solana program extend 9quyDwnt… 40960 --url devnet`.

---

## 5. État des clés

| Fichier | Rôle | État |
|---|---|---|
| `contracts/target/wallet/wallet.json` | Autorité d'upgrade `8eui3v5…` | présent |
| `contracts/target/wallet/id.json` | Copie, nom attendu par Anchor | présent |
| `target/deploy/workspace-keypair.json` | Keypair du programme | **absent du dépôt** |

L'absence du keypair du programme n'est pas bloquante : il ne sert qu'au
**premier** déploiement à une adresse donnée, qui a déjà eu lieu. Les upgrades
n'engagent que l'autorité. Le seul scénario où il redeviendrait nécessaire
serait un redéploiement à la même adresse après fermeture du programme.

`node scripts/keys-check.mjs` dérive les pubkeys réelles des keypairs présents
et les compare à l'autorité attendue — un fichier de keypair n'est qu'un
tableau de 64 octets, rien à le regarder ne dit à quelle adresse il
correspond. Sans ce contrôle, l'erreur se découvre au moment de l'upgrade,
c'est-à-dire trop tard.

> ⚠️ `wallet.json` est une clé privée en clair, versionnée. Acceptable en
> devnet, et seulement là. Avant tout mainnet : régénérer l'autorité, la
> sortir du dépôt, considérer celle-ci comme brûlée.

---

## 6. Points de vigilance permanents

1. **Divergence silencieuse.** Un frontend et un programme désaccordés
   n'affichent aucune erreur tant que les discriminateurs sont inchangés. Ça
   casse à la signature, pas au build. Seul `idl-check.mjs` le révèle.
2. **Aucun déploiement du programme depuis un workspace assisté** — risque de
   régénérer le keypair et donc de changer le Program ID.
3. **`workspace-keypair.json` ne doit jamais être versionné.**
4. **`project_id` est un seed brut.** Tout caractère non-ASCII fait dépasser
   les 20 octets silencieusement. À contraindre côté UI.
5. **Poussière d'arrondi.** Après `distribute`, quelques lamports restent dans
   le vault ; `close_project` les tolère sous 1000. L'UI ne doit pas présenter
   ce solde comme une anomalie.
6. **L'ordre des champs de `Project` est load-bearing.** Trois Edge Functions
   lisent `creator` aux octets 8..40 sans Anchor. Un réordonnancement les
   casserait sans erreur de compilation.

---

## 7. Journal de décisions

| Date | Décision |
|---|---|
| — | Scénario A : Program ID conservé, upgrade en place exécuté en local |
| — | Frontend existant réutilisé, pas de reconstruction |
| — | ~~Borne à 2000 octets~~ annulé — dépasse la limite de 1232 o par transaction |
| 27/08 | Borne fixée à **500 octets**, compteur UI obligatoirement en octets |
| 27/08 | `update_description` retenu, avec `realloc` — sert aussi de migration |
| 27/08 | `MAX_TITLE_LEN` 40→80, `MAX_ROLE_LEN` 24→32 groupés dans le même upgrade |
| 27/08 | `MAX_PROJECT_ID_LEN` et `MAX_MEMBERS` inchangés |
| 27/08 | `protocol_wallet` conservé ; `revoke_approval` / `update_member_share` écartés |
| 27/08 | Autorité d'upgrade retrouvée et restaurée, solde 4.754 SOL |
| 28/08 | Upgrade devnet annoncé — signature `67Vmcg4F6Fg…NB8ufam`, **à revérifier** |
| 28/08 | Écritures Supabase entièrement déportées derrière Edge Functions, policies publiques fermées |
| 28/08 | Sessions de chat : jeton signé 24 h, révocation serveur par cutoff daté |
| 28/08 | Plan du 27/08 archivé dans `docs/archive/`, remplacé par ce document |

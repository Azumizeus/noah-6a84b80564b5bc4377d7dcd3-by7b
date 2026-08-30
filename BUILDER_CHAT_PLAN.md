# Chat entre builders — document de cadrage (30/08, PROPOSITION)

Statut : **aucune ligne de code écrite**. Ce qui existe déjà et qu'il ne
faut pas confondre :

- `ChatBox.tsx` : chat **par pact**, visible aux seuls membres d'un pact
  commun. Portée = un projet, pas une relation entre deux personnes.
- `ContactInbox` : demandes de contact (asynchrone, pas un chat live).
- `ChatSessionsPanel.tsx` (page Profil) : gestion des jetons de session de
  chat (révocation) — **pas une interface de chat**, malgré le nom.

Ce qui manque : une conversation directe entre deux builders, indépendante
de tout pact commun — ce que l'utilisateur demande.

## 1. Modèle de données proposé

Réutilise la mécanique déjà validée pour le chat par-pact (sessions 24h,
bearer token, rate limit) plutôt que d'en inventer une nouvelle :

- `dm_threads` (id, wallet_a, wallet_b, created_at) — une ligne par paire
  de wallets, `wallet_a < wallet_b` pour éviter les doublons (A→B et B→A).
- `dm_messages` (id, thread_id, sender_wallet, content, created_at).
- RLS : lecture/écriture uniquement si `auth.wallet()` ∈ {wallet_a,
  wallet_b} du thread concerné.

## 2. Points d'entrée UI

- Depuis `BuilderDetailModal.tsx` (déjà consulté pour le profil d'un
  builder) : bouton "Envoyer un message" → ouvre/crée le thread.
- Nouvelle entrée dans le dashboard profil (`FreeGrid`) : liste des
  conversations actives, façon boîte de réception.
- Notification (le système `NotificationSettings` existe déjà pour
  d'autres événements — un nouveau type "message reçu" s'y greffe).

## 3. Différences avec le chat par-pact à anticiper

- Pas de notion de "membres approuvés" à vérifier — n'importe quel wallet
  peut initier un DM. Si abus (spam), prévoir un blocage simple
  (`blocked_wallets`, table à part) plutôt qu'un système de permission
  lourd.
- Le rate limit (10 msg/min sur le chat par-pact) doit s'appliquer par
  wallet, tous threads confondus, pas par thread — sinon un spammeur ouvre
  N threads pour contourner la limite.
- Si la **console admin** (voir `ADMIN_CONSOLE_PLAN.md`) est construite en
  parallèle, la modération de ces DM (masquer un message signalé) doit
  passer par la même Edge Function d'admin plutôt qu'un chemin séparé.

## 4. Découpage proposé

1. Schéma (`dm_threads`/`dm_messages`) + RLS + Edge Function d'écriture
   (même mécanique de jeton 24h que le chat existant).
2. UI minimale : ouvrir un thread depuis `BuilderDetailModal`, liste +
   fenêtre de conversation.
3. Notifications + entrée dashboard profil.
4. Blocage d'un wallet (anti-spam) — peut attendre si le lot 2 suffit pour
   un premier usage réel.

---

**Prochaine étape** : confirmer ce découpage (ou une portée plus réduite
pour un premier jet), puis commencer par le lot 1.

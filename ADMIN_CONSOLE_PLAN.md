# Console admin/dev — document de cadrage (30/08, PROPOSITION)

Statut : **aucune ligne de code écrite**. Demande utilisateur : interface
de debug système, logs, modération du chat, activité du site, ban/blocage,
don d'XP manuel, détection d'erreurs auto-optimisante, accès réservé
développeurs/admins/employés par "code caché", et une question séparée sur
le 2FA. Ce document tranche le modèle avant d'écrire quoi que ce soit —
conformément à la règle du projet (annoncer + attendre GO avant toute
fonctionnalité qui touche à l'authentification/aux permissions).

## 1. Le point de sécurité à trancher en premier

**Un "code caché" (route non listée, raccourci clavier secret) n'est PAS
une protection en soi.** N'importe qui inspectant le bundle JS (accessible
à tous, publié sur Vercel) peut lister toutes les routes définies dans le
router — une route `/xk9-admin-2026` apparaît en clair dans le code livré
au navigateur, exactement comme `/dashboard`. La confidentialité de l'URL
ne résiste pas à quelqu'un qui ouvre les DevTools.

Ce qui protège réellement : un contrôle de rôle vérifié **côté serveur**
(RLS Supabase ou Edge Function), pas côté client. Le "code caché" reste
une bonne idée comme **commodité d'accès** (éviter un bouton "Admin" visible
dans la nav pour tout le monde), mais jamais comme unique verrou.

**Modèle recommandé** :
1. Table `admin_roles` (wallet, rôle : `dev` / `moderator` / `admin`,
   ajouté manuellement en base, jamais via l'UI publique).
2. Policy RLS sur chaque table sensible (`n'importe quelle écriture de
   modération, XP, ban` ) : `exists (select 1 from admin_roles where
   wallet = auth.wallet() and role in (...))`.
3. Route front non listée dans la nav (ex. `/nexus-control`) + vérif
   côté client (cache l'UI, confort) + **la vraie barrière est le rejet
   RLS/Edge Function si le wallet n'est pas dans `admin_roles`**.
4. Chaque action sensible (ban, XP manuel, modification de log) passe par
   une **Edge Function signée** (même mécanique que `project-write`
   aujourd'hui) plutôt qu'un insert direct — trace d'audit garantie côté
   serveur, jamais falsifiable depuis le front.

## 2. Fonctions demandées — faisabilité et effort

| Fonction demandée | Faisabilité | Ce que ça implique |
|---|---|---|
| Logs système (erreurs, requêtes) | Oui | Table `system_logs` + Edge Function qui logue ses propres erreurs ; le front (erreurs React) peut pousser vers la même table via un handler d'erreur global |
| Activité du site (vue d'ensemble) | Oui, existe en partie | `ActivityFeed`/`project_updates` déjà en place — la console admin peut être une vue agrégée, tous projets confondus, réservée aux rôles admin |
| Chat modérateur | Oui | Lecture cross-pact des messages (RLS actuelle limite aux membres d'un même pact) + action `hide_message`/`mute` via Edge Function |
| Bannir / bloquer un utilisateur | Oui | Colonne `banned_at`/`banned_reason` sur `profiles` + vérif dans les Edge Functions d'écriture (rejeter si banni) |
| Donner de l'XP à n'importe quel utilisateur | Oui | Nouvelle action Edge Function `admin-grant-xp`, distincte du flux XP normal (qui est vérifié par transaction) — **doit rester dans un audit log** (qui, combien, quand, pourquoi) pour éviter tout abus, même par un admin légitime |
| Détection d'erreurs qui "apprend de lui-même pour toujours optimiser le système et fonctionner à 100%" | **Partiellement réaliste — à recadrer** | Voir §3 |

## 3. Sur l'auto-apprentissage / "fonctionner à 100%"

Un système qui se corrige et se déploie lui-même sans supervision n'est ni
raisonnable ni souhaitable pour une app en production avec de l'argent
réel dessus (même en devnet) — c'est un vecteur d'incident si le
"correctif automatique" fait une erreur de jugement. Le pattern
réaliste et déjà largement utilisé en industrie :

1. **Collecte structurée** : toute erreur (front + Edge Functions) part
   dans `system_logs` avec contexte (route, wallet si dispo, stack, payload
   anonymisé).
2. **Agrégation** : la console admin regroupe les erreurs par fréquence/
   type, pas une liste brute — permet de voir "cette erreur explose depuis
   ce déploiement" en un coup d'œil.
3. **Assistance IA, pas autonomie** : Nexus (ou un modèle dédié) peut lire
   ces logs sur demande et **proposer** un diagnostic/correctif — un
   humain (toi) reste dans la boucle pour valider avant tout déploiement.
   C'est la même politique que celle déjà en place pour le programme
   Anchor ("annoncer + attendre GO").
4. Un "système qui fonctionne à 100%" n'existe pas au sens absolu — l'
   objectif réaliste est un **temps de détection court** et un
   **historique exploitable**, pas zéro incident garanti.

## 4. Découpage proposé (par lots, chacun testable seul)

1. **RBAC minimal** : table `admin_roles`, policies RLS, route cachée +
   garde côté client. Rien d'autre tant que ce lot n'est pas validé en
   live.
2. **Logs système** : table + handler d'erreur global front + logging
   Edge Functions. Vue de consultation simple (liste, filtre par sévérité/
   date).
3. **Modération chat + activité** : vue cross-pact, action masquer/mute.
4. **Ban/blocage** : colonne + vérif dans les Edge Functions existantes
   (chat, network, project-write...).
5. **Don d'XP manuel** : Edge Function dédiée + audit log visible dans la
   console.
6. **Assistance diagnostic IA (optionnel, plus tard)** : Nexus branché en
   lecture sur `system_logs`, propose sans jamais agir seul.

## 5. 2FA — faisabilité

BuildPact grand public s'authentifie par **signature wallet**
(`signMessage`), pas par mot de passe — le 2FA classique (TOTP/SMS après
mot de passe) n'a pas d'équivalent direct ici, il n'y a pas de mot de
passe à doubler.

Là où le 2FA prend son sens : **les comptes admin/dev** de la console
ci-dessus, si on veut une couche au-delà de "posséder ce wallet suffit".
Deux options réalistes :
- **TOTP applicatif** (Google Authenticator/Authy) sur les wallets listés
  dans `admin_roles` : au moment d'une action sensible (ban, XP manuel),
  demander un code à 6 chiffres en plus de la signature. Secret TOTP
  stocké côté Supabase (jamais dans le bundle front), vérifié par l'Edge
  Function avant d'exécuter l'action.
- **Multi-signature** (2 wallets admin doivent approuver) pour les actions
  les plus sensibles (ex. don d'XP au-dessus d'un seuil) — plus lourd,
  pertinent seulement si l'équipe s'agrandit.

Recommandation pour une équipe d'une personne aujourd'hui : TOTP simple
sur les actions sensibles de la console admin, pas de multi-sig pour
l'instant — peut être ajouté plus tard sans tout refaire si `admin_roles`
est bien structurée dès le lot 1.

## 6. Ce qui ne change pas

Program ID, Config PDA, logique de distribution/finalisation des pacts —
la console admin est entièrement une couche Supabase/frontend, aucun
impact sur le programme Anchor.

---

**Prochaine étape** : valider le découpage en lots (§4) et l'ordre voulu,
puis commencer par le lot 1 (RBAC) — rien d'autre n'a de sens sans lui.

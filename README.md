# escape-engine

Moteur d'escape game sur mesure : le joueur reçoit un code d'invitation, rejoint un
jeu et enchaîne des énigmes (texte, capteurs du téléphone, mini-jeux embarqués)
pendant que l'organisateur suit la progression depuis une console d'administration.

- **Front** — pages statiques dans `public/`, sans étape de build.
- **Serveur** — 25 fonctions Netlify dans `netlify/functions/`, réservées aux administrateurs.
- **Données** — Supabase (base Postgres, authentification, stockage des médias).

## Les pages

| Page | Pour qui | Rôle |
|------|----------|------|
| `index.html` | Joueur | Le moteur : intro, hub, énigmes, écran de victoire. 1 jeu = 1 `?slug=`. |
| `rejoindre.html` | Joueur | Inscription / connexion à partir d'un code d'invitation. |
| `catalogue.html` | Public | Liste des jeux publiés. Non référencé ailleurs — son avenir est en suspens. |
| `admin.html` | Organisateur | Jeux, joueurs, codes, thèmes, bibliothèque d'énigmes, statistiques. |
| `editeur.html` | Organisateur | Édition d'un jeu (`?id=<uuid>`), aperçu, export `config.json`. |
| `module/*.html` | — | Mini-jeux embarqués en iframe (cadenas, piano, simon, mots mêlés…). |

Les mini-jeux se configurent par la query string et signalent leur réussite au moteur
par un `postMessage` de type `ramscape:solved`. Exemple :

```
module/cadenas.html?molettes=4&solution=1986&validate=1&title=Code%20d'acces
```

> La solution voyage en clair dans l'URL de l'iframe : elle est lisible par un joueur
> qui ouvre l'inspecteur. C'est un choix assumé pour un jeu entre amis.

## Variables d'environnement

À définir dans Netlify (Site settings → Environment variables). Elles ne sont lues
que par les fonctions serveur et ne doivent jamais apparaître dans `public/`.

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL du projet Supabase. |
| `SUPABASE_SERVICE_KEY` | Clé de service (pleins pouvoirs). **Jamais côté client.** |

L'URL du projet et la clé *publiable* sont écrites en dur dans les pages de `public/`
(c'est leur usage prévu), mais elles y sont recopiées cinq fois — voir `AUDIT.md` (M-03).

## Développement local

```sh
npm install
npx netlify dev        # sert public/ + les fonctions sur http://localhost:8888
```

Sans les variables d'environnement, les fonctions répondent en erreur mais le moteur
reste utilisable : `index.html` retombe sur la configuration embarquée.

## Schéma de la base

> ⚠️ **Reconstitué depuis le code, à vérifier.** Le schéma réel et surtout les
> politiques RLS ne sont pas dans ce dépôt : ils vivent uniquement dans la console
> Supabase. Tant que ce n'est pas corrigé (`AUDIT.md`, S-02), rien ne garantit qu'un
> joueur ne peut pas écrire dans la partie d'un autre, et une base perdue ne peut pas
> être recréée à l'identique. À remplacer par un export réel dans `supabase/schema.sql`.

| Table | Colonnes utilisées par le code |
|-------|-------------------------------|
| `jeux` | `id`, `slug`, `name`, `client`, `note`, `version`, `theme_id`, `branding`, `enigmas`, `acts`, `act_boundaries`, `intro`, `reglages`, `statut`, `updated_at` |
| `joueurs` | `id` (= uid auth), `pseudo`, `jeu_id`, `actif`, `code_utilise`, `equipe_id`, `created_at` |
| `equipes` | `id`, `code` (unique → `codes.code`), `jeu_id`, `nom`, `created_at` |
| `parties_equipe` | La progression partagée, même forme que `parties` mais portée par l'équipe — unicité sur (`equipe_id`, `jeu_id`) |
| `activite` | Le fil : `equipe_id`, `joueur_id`, `pseudo`, `type`, `enigme_index`, `contenu`, `reussie`, `created_at` |
| `parties` | `joueur_id`, `jeu_id`, `enigme_courante`, `resolues`, `indices_utilises`, `termine`, `updated_at` — unicité sur (`joueur_id`, `jeu_id`) |
| `tentatives` | `joueur_id`, `jeu_id`, `enigme_index`, `reussie`, `reponse` |
| `evenements` | `joueur_id`, `jeu_id`, `type`, `enigme_index`, `created_at` |
| `codes` | `code`, `jeu_id`, `label`, `actif`, `max_joueurs`, `expire_le`, `created_at` |
| `themes` | `id`, `name`, `colors`, `fonts`, `radius`, `glow`, `updated_at` |
| `admins` | `id` — la seule appartenance qui ouvre les fonctions serveur |
| `bibliotheque_enigmes` | `id`, `titre`, `categorie`, `tags`, `enigme`, `created_at` |

`statut` vaut `brouillon`, `publie` ou `archive`. Le stockage utilise un bucket public
`assets`, rangé par slug de jeu.

Supprimer un compte auth supprime en cascade son profil, sa progression, ses
tentatives et ses événements.

## Inscription d'un joueur

Le navigateur n'écrit rien dans la base et ne lit jamais la table `codes`. Le parcours
passe par deux fonctions publiques, seules à connaître les codes :

1. `code-resolve` — `POST { code }` → `{ name, slug }`, pour l'aperçu « Tu rejoins : X ».
   Ne renvoie ni l'identifiant du jeu, ni le quota, ni la date d'expiration.
2. `rejoindre` — `POST { code, pseudo, password }`. Vérifie le code, son activation,
   son expiration, son quota et que le jeu est publié ; crée le compte et le profil.
   Si le profil échoue, le compte est supprimé — pas de compte orphelin.

Le navigateur enchaîne ensuite sur un `signInWithPassword()` normal. La connexion d'un
joueur existant est inchangée.

L'adresse technique d'un compte (`pseudo@slug.joueurs.local`) est produite par
`emailJoueur()` dans `_auth.js` et par `synthEmail()` dans `rejoindre.html`. **Ces deux
fonctions doivent rester identiques** : elles définissent l'identité des comptes
existants, et les désynchroniser empêcherait les joueurs de se connecter.

## Lecture publique des jeux

`jeux-publics` — `GET` pour la liste des jeux publiés, `GET ?slug=` pour un seul.
Ne renvoie que `slug`, `name`, `client` et `version`.

La table `jeux` porte la colonne `enigmas`, c'est-à-dire les énigmes **avec leurs
réponses**. Une policy RLS ne sait pas filtrer par colonne : c'est pourquoi le catalogue
et l'aperçu du nom de jeu passent par cette fonction plutôt que de lire la table
directement. Ne jamais élargir `CHAMPS` sans se demander ce qui devient public.

## Jeu en équipe

**Un code d'invitation = une équipe.** `codes.label` la nomme, `codes.max_joueurs` la
plafonne ; le joueur n'a rien de plus à saisir. `rejoindre.js` crée l'équipe à la
première inscription et y rattache les suivantes — le navigateur n'a aucune policy
d'insertion sur `equipes`.

`joueurs.equipe_id` à `NULL` signifie **mode solo** : la progression reste dans
`parties`, exactement comme avant. C'est le cas de tous les comptes créés avant les
équipes, et c'est ce qui tourne sur `main`. `parties` n'a pas été modifiée.

En équipe, la progression vit dans `parties_equipe` et chaque geste laisse une trace
attribuée dans `activite` : qui a proposé quoi, ce que ça valait, qui a résolu, qui a
pris un indice. Le moteur s'abonne aux deux tables en Realtime (`abonnerEquipe()`), si
bien qu'une résolution se répercute chez les coéquipiers sans rechargement, avec un
bandeau et un fil consultable depuis le hub.

Ajouter une table au fil suppose de l'ajouter à la publication `supabase_realtime` —
sans quoi l'abonnement ne reçoit rien (voir `supabase/migration-02-equipes.sql`).

## Chrono

`jeux.reglages` (jsonb) porte les réglages de déroulé. Aujourd'hui une seule clé :
`dureeMinutes`. Vide ou absente, aucun chrono ne s'affiche.

Le compte à rebours est **indicatif** : à zéro il bascule en dépassement et continue de
compter, mais rien ne se verrouille et la partie reste terminable. L'origine du temps est
l'événement `debut` enregistré en base, jamais un compteur local — un rechargement de
page ou un changement d'appareil ne remet donc rien à zéro.

## Mini-jeux intégrés

Le catalogue `MODULES` (`public/editeur.html`) décrit chaque module de `public/module/`
et ses paramètres ; l'éditeur génère l'URL. Il fallait auparavant l'écrire à la main
(`?molettes=4&solution=1986&validate=1`) sans documentation nulle part.

Deux conventions à connaître si tu ajoutes un module :

- `valide: false` — le module est un support de réflexion et ne valide pas l'énigme
  (César, lampe UV). Aucune case à cocher n'est proposée.
- `valideParDefaut: true` — le module valide sauf si `validate=0` (`guess-where`), à
  l'inverse des autres qui exigent `validate=1`. Le catalogue inverse l'écriture du
  paramètre pour que la case à cocher veuille dire ce qu'elle affiche.

La saisie libre reste disponible pour les services tiers (lockee, ladigitale).

## Sécurité

Toutes les fonctions d'administration passent par `requireAdmin`
(`netlify/functions/_auth.js`), qui valide le jeton **puis** vérifie l'appartenance à la
table `admins`. Toute nouvelle fonction doit faire de même dès sa première ligne. Les
trois seules fonctions publiques sont `manifest`, `code-resolve` et `rejoindre`.

Le durcissement RLS correspondant a été appliqué : `codes` n'est plus lisible depuis
le navigateur et l'insertion publique dans `joueurs` est retirée. Compte rendu et
retour arrière dans [`supabase/policies-s04.sql`](supabase/policies-s04.sql).

Les 9 tables ont depuis été auditées ([`supabase/diagnostic-s02.sql`](supabase/diagnostic-s02.sql)
rejoue l'inventaire). `parties`, `tentatives` et `evenements` sont correctement cadrées
sur `auth.uid()`.

La table `jeux` porte les énigmes avec leurs réponses : sa lecture est restreinte au jeu
auquel le joueur est inscrit ([`supabase/policies-s02-jeux.sql`](supabase/policies-s02-jeux.sql)).
`anon` n'y a plus aucun accès.

L'audit complet du dépôt est dans [`AUDIT.md`](AUDIT.md), avec l'état de chaque constat
et ce qui reste ouvert.

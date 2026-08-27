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
| `catalogue.html` | Public | Liste des jeux publiés. |
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
| `jeux` | `id`, `slug`, `name`, `client`, `note`, `version`, `theme_id`, `branding`, `enigmas`, `acts`, `act_boundaries`, `intro`, `statut`, `updated_at` |
| `joueurs` | `id` (= uid auth), `pseudo`, `jeu_id`, `actif`, `code_utilise`, `created_at` |
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

## Sécurité

Toutes les fonctions serveur passent par `requireAdmin` (`netlify/functions/_auth.js`),
qui valide le jeton **puis** vérifie l'appartenance à la table `admins`. Toute nouvelle
fonction doit faire de même dès sa première ligne.

L'audit complet du dépôt est dans [`AUDIT.md`](AUDIT.md). Les points encore ouverts y
sont listés — le plus important étant que le code d'invitation n'est aujourd'hui
vérifié que côté navigateur (S-04).

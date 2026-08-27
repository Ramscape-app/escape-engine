# Audit du dépôt `escape-engine`

Revue complète du code au commit `db2b3e2` — 44 fichiers, 8 266 lignes suivies par git.
Front statique (Netlify) + 25 fonctions serveur + Supabase (auth, base, stockage).

**29 constats : 1 critique · 7 élevés · 9 moyens · 12 faibles.**

## Synthèse

Le socle serveur est sain : les 25 fonctions mutatrices passent toutes par `requireAdmin`,
qui valide le jeton *et* l'appartenance à la table `admins`. Aucun contournement trouvé,
et la clé de service ne fuite ni côté client ni dans l'historique (50 commits vérifiés).

Le problème est la frontière entre ce que le client peut lire et ce qu'il doit ignorer :
`catalogue.html` sert les réponses de tous les jeux à des visiteurs anonymes, le code
d'invitation n'est vérifié que dans le navigateur, et l'intégrité des données repose
entièrement sur des policies RLS absentes du dépôt.

Côté fonctionnel, deux fonctionnalités visibles dans l'admin ne font rien : les pages
d'intro personnalisées ne s'affichent jamais en jeu réel, et désactiver un joueur ne le
bloque pas.

---

## Sécurité et confidentialité

| # | Sév. | Constat | Emplacement |
|---|------|---------|-------------|
| S-01 | **Critique** | `catalogue.html` est public et sélectionne `enigmas` (réponses comprises) juste pour compter les énigmes. Aucun code d'invitation requis. | `public/catalogue.html:29` |
| S-02 | Élevée | Schéma et policies RLS absents du dépôt, alors que le client écrit directement dans `joueurs`, `parties`, `tentatives`, `evenements`. Non relisible, non versionné, non restaurable. | aucun `.sql` |
| S-03 | Élevée | Listener `message` sans contrôle de `ev.origin` : toute iframe tierce (`lockee.fr`, `scape.enepe.fr`, `ladigitale.dev`) peut valider l'énigme courante. | `public/index.html:1962` |
| S-04 | Élevée | Le code d'invitation n'est vérifié que côté client ; l'insertion dans `joueurs` se fait depuis le navigateur avec un `jeu_id` arbitraire. La table `codes` est lisible par la clé anon (énumération). | `public/rejoindre.html:86-93, 126-133` |
| S-05 | Moyenne | `ping.js` : endpoint non authentifié instanciant un client à clé de service ; renvoie le nombre de joueurs. | `netlify/functions/ping.js` |
| S-06 | Moyenne | `manifest.js` ne filtre pas `statut='publie'` → révèle le nom des jeux en brouillon. | `netlify/functions/manifest.js:14-16` |
| S-07 | Faible | `asset-upload` : `slug` non normalisé dans le chemin de stockage (le nom de fichier l'est) ; pas de liste blanche MIME ni de taille max. | `netlify/functions/asset-upload.js:12-16` |
| S-08 | Faible | Les modules reçoivent leur solution en clair dans l'URL (`?solution=`, `?message=`, `?sequence=`). | `public/module/*.html` |
| S-09 | Faible | `devSkip()` / `devSolveAll()` restent globaux alors que la barre DEV est commentée. | `public/index.html:3516-3531` |
| S-10 | Faible | Iframes sans `sandbox`/`referrerpolicy` ; deux constructions HTML non échappées côté admin. | `index.html:2292-2310`, `editeur.html:1418`, `admin.html:576` |

## Défauts fonctionnels

| # | Sév. | Constat | Emplacement |
|---|------|---------|-------------|
| F-01 | Élevée | **Les pages d'intro personnalisées ne s'affichent jamais en jeu réel** : `loadFromSupabase()` ne sélectionne pas la colonne `intro`, que le moteur lit pourtant. Correct en aperçu admin (`jeu-get` la renvoie), cassé pour les joueurs. | `index.html:1758, 1765-1771, 2055` |
| F-02 | Élevée | **Désactiver un joueur ne le bloque pas** : `authGuard()` ne lit jamais `actif`. | `index.html:1781-1815, 1802` |
| F-03 | Moyenne | `max_joueurs` et `expire_le` stockés et affichés, jamais appliqués. `expire_le` n'est même pas envoyé par le formulaire admin. | `admin.html:492-495`, `code-create.js:20-22` |
| F-04 | Moyenne | La duplication d'un jeu perd son `intro`. | `netlify/functions/jeu-duplicate.js:24-30` |
| F-05 | Moyenne | Inscription non transactionnelle : si l'insertion du profil échoue après `signUp`, le compte auth reste orphelin — le joueur ne peut plus ni s'inscrire ni jouer. | `rejoindre.html:124-134` |
| F-06 | Faible | `synthEmail` supprime tout sauf `[a-z0-9]` : « Jean-Luc », « jean luc » et « JeanLuc » collisionnent. Pseudo sans alphanumérique → adresse invalide. | `rejoindre.html:75-78`, `joueur-create.js:14-15` |
| F-07 | Faible | Le service worker ne met rien en cache ; son repli `caches.match()` résout toujours `undefined` et fait échouer la requête. | `public/sw.js` |
| F-08 | Faible | Code mort : `currentGame.codeUsed` inexistant, paramètre `html` de `set()` jamais passé, 11 `console.log`. | `rejoindre.html:131`, `index.html:1692-1696` |

## Robustesse et exploitation

| # | Sév. | Constat | Emplacement |
|---|------|---------|-------------|
| R-01 | Moyenne | Aucune fonction ne vérifie `req.method` (26/26). Un GET sur `jeu-save` produit une 502 opaque au lieu d'un 405. | `netlify/functions/*.js` |
| R-02 | Moyenne | `req.json()` jamais protégé (15 appels hors `try`) : corps malformé → exception non gérée. | `netlify/functions/*.js` |
| R-03 | Moyenne | `stats.js` et `joueurs-list.js` chargent les tables entières sans pagination. Passé la limite PostgREST (1 000 lignes), les statistiques deviennent fausses silencieusement. | `stats.js:9-16`, `joueurs-list.js:9-20` |
| R-04 | Faible | `netlify.toml` laisse `[functions]` en commentaire (« plus tard ») alors que les fonctions tournent déjà par convention. | `netlify.toml:7-9` |
| R-05 | Faible | Pas de `package-lock.json`, dépendance en `^2` : déploiements non reproductibles. | `package.json` |
| R-06 | Faible | `supabase-js@2` et Leaflet chargés depuis des CDN sans `integrity`. | `index.html:15-16` + 4 pages |

## Maintenabilité

| # | Sév. | Constat | Emplacement |
|---|------|---------|-------------|
| M-01 | Élevée | Monolithes : `index.html` 3 639 l. (styles + config + moteur + capteurs), `editeur.html` 1 594 l., `admin.html` 807 l. Rien n'est isolable ni testable. | — |
| M-02 | Élevée | La config complète d'un vrai jeu client (« PROJET 1986 », 40 énigmes + réponses) est dupliquée mot pour mot dans le moteur et l'éditeur : ~1 200 lignes en double, servant de repli à l'un comme à l'autre. | `index.html:1044-1640`, `editeur.html:217-830` |
| M-03 | Moyenne | Duplication des utilitaires : 5 déclarations de `SUPABASE_URL`, 2 `callFn`, 3 `esc`, 25 `json()`. | — |
| M-04 | Faible | `public/module/mots-meles` est une copie identique sans extension de `mots-meles.html` (servie en `text/plain`). `guide-iframe.png` (146 Ko) n'est référencé nulle part et est hors de `public/`. | — |
| M-05 | Faible | Ni README, ni `.gitignore`, ni test, ni linter, ni CI. Variables d'environnement et 9 tables non documentées. | — |

---

## Ce qui est solide

- **Contrôle d'accès admin correct**, sans faille trouvée : double vérification (jeton + table `admins`), aucune fonction oubliée.
- **La clé de service ne fuite pas**, ni côté client ni dans l'historique git.
- **Échappement méthodique** dans les vues d'administration (`esc()` systématique, `textContent` pour le pseudo joueur) ; les deux oublis de S-10 sont l'exception.
- **Isolation de la progression entre jeux pensée** : clé locale par slug, filtrage des index hors plage, remise à zéro pour un nouveau joueur.
- **Fonctions serveur courtes et lisibles**, style constant, messages d'erreur en français.

## Par où commencer

1. **Retirer `enigmas` du select de `catalogue.html`** — une ligne, supprime la seule fuite ouverte aux anonymes. (S-01)
2. **Filtrer l'origine dans le listener `message`** — une condition. (S-03)
3. **Corriger les trois oublis de colonnes** — `intro` au chargement et à la duplication, `actif` dans `authGuard`. (F-01, F-02, F-04)
4. **Versionner le schéma et les policies RLS** — rien d'autre n'est vérifiable sans ça. (S-02)
5. **Déplacer l'inscription par code dans une fonction serveur** — résout quatre constats : validation réelle, quota, expiration, atomicité. (S-04, F-03, F-05)
6. **Mutualiser les utilitaires** — garde de méthode, lecture JSON protégée, helper de réponse, client Supabase partagé. (M-03, R-01, R-02)
7. **Extraire la config « 1986 » et découper `index.html`** — quand le reste est stable. (M-01, M-02)

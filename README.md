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
| `repondre.html` | Complice | Le questionnaire d'un proche (`?jeton=`). Aucune clé, aucun accès direct à la base. |
| `catalogue.html` | Public | Liste des jeux publiés. Non référencé ailleurs — son avenir est en suspens. |
| `admin.html` | Organisateur | Clients, catalogue de questions, jeux, joueurs, codes, thèmes, bibliothèque, suivi en direct, statistiques, débrief. Deux modes, clair et sombre. |
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

## Vérifications

```sh
npm run check      # les deux ci-dessous
npm run verifier   # contrôles structurels
npm test           # règles de publication
```

Le projet n'a pas d'étape de build : ces contrôles sont le seul filet entre une
modification et la production. Ils tournent sur chaque poussée et chaque PR
(`.github/workflows/ci.yml`).

`scripts/verifier.mjs` couvre 301 contrôles — syntaxe des fonctions et des scripts
inline, équilibre des blocs CSS et des balises, ids référencés par le JS mais absents
du HTML, absence de clé de service dans une page publique, présence de `requireAdmin`
sur toute fonction non listée comme publique, et de `resoudreJeton` sur chaque
`repondre-*`.

Chacun vient d'un défaut qui s'est réellement produit :

| Contrôle | Ce qu'il a attrapé |
|---|---|
| Colonnes énumérées sur `themes` | PostgREST rejette la requête entière dès qu'une colonne demandée manque : un jeu était retombé sur le thème par défaut après une migration non encore appliquée. `themes(*)` survit à toute colonne ajoutée. |
| Deux fonctions du même nom dans une page | Dans un monolithe d'un seul tenant, la seconde écrase la première et un bouton se met à faire autre chose. Arrivé avec `basculer()`. |
| Champ de saisie sans règle qui lui donne un fond | Tous les `textarea` de la console s'affichaient **sur fond blanc** dans une interface sombre. Le critère est « une règle lui donne un fond », pas « une règle existe » : l'admin avait bien un `.projetgrid textarea{resize}`. |
| Écriture dans le bucket public `assets` | Seules `asset-upload`, `asset-url` et `media-promouvoir` y ont droit — tout le reste contournerait la promotion explicite des photos de complices. `createSignedUploadUrl` compte comme une écriture. |
| Source de tuiles écrite en dur | CARTO s'est mis à exiger une clé et les deux cartes se sont couvertes d'un filigrane, sans erreur ni trace. Le fond se déclare dans `shared/carte.js`. |

`scripts/inventaire-admin.mjs` relève les classes, ids et jetons de la console. Il sert
au kit de design (`design/`) et permet de vérifier qu'un retour de refonte n'a rien
perdu en route.

## Dépendances externes

`@supabase/supabase-js` et Leaflet sont chargés depuis jsDelivr, **version figée et
empreinte SRI** : le navigateur refuse le fichier s'il a été modifié. Ces pages portent
la session d'authentification, un script CDN altéré y aurait accès.

`node scripts/sri.mjs` recalcule les empreintes depuis `node_modules` — jsDelivr sert
le contenu npm à l'octet près, donc aucun accès réseau n'est nécessaire. **À relancer
après toute montée de version**, sinon le navigateur refusera de charger le script.

Leaflet n'est récupéré qu'à l'ouverture de la première énigme GPS : les jeux sans carte
ne paient pas ses 150 Ko. Si le chargement échoue, l'énigme reste jouable sans fond de
carte.

### Le modèle « PROJET 1986 »

Déclaré dans `public/shared/modele-1986.js` et lu par **trois** endroits : le moteur
(copie de secours si la configuration du jeu est injoignable), l'éditeur (modèle de
départ d'un jeu vide) et la console (la réserve d'énigmes à importer dans la
bibliothèque).

Il vivait en double — `EMBEDDED_CONFIG` dans le moteur, `DEFAULT_CONFIG` dans l'éditeur,
deux littéraux de 18 Ko mot pour mot identiques. C'était le constat **M-02** de l'audit :
modifier l'un laissait l'autre derrière sans que rien ne le signale.

> ⚠️ Deux énigmes GPS (« Signal Localisé », n° 16 et 24) n'ont pas de coordonnées : elles
> dépendent du lieu de l'événement. Le validateur les signale et la publication reste
> bloquée tant qu'elles sont vides.

### La bibliothèque

`bibliotheque_enigmes` ne contient **que ce qu'on y met** : depuis l'éditeur avec
*Sauver en biblio*, une énigme à la fois, ou via le bouton **Importer les 40 énigmes du
modèle** de la vue Bibliothèque.

Ce bouton existe parce que les deux stocks n'avaient jamais été reliés : les énigmes du
modèle étaient inaccessibles autrement qu'en chargeant le modèle entier dans un jeu.
L'import se fait **en un appel** — quarante allers-retours seraient interruptibles au
milieu — et **dédoublonne sur le titre**, donc on peut le relancer sans risque. C'est
d'ailleurs nécessaire dès le premier import : le modèle porte deux fois « Signal
Localisé ».

### Le fond de carte

Déclaré **en un seul endroit**, `public/shared/carte.js`, et utilisé par l'énigme GPS du
moteur comme par le mini-jeu `guess-where`.

Il était auparavant écrit en dur dans les deux pages, et pointait sur CARTO. Le jour où
CARTO s'est mis à exiger une clé d'API, les deux cartes se sont couvertes d'un filigrane
« API KEY REQUIRED » — **sans erreur, sans trace, et visible uniquement par un joueur en
pleine partie**. C'est le défaut que ce fichier existe pour empêcher :

- **une seule source**, changeable en une ligne (`DEFAUT`) ;
- **un échec se voit** : si aucune tuile ne charge, la page le dit à sa façon au lieu de
  laisser un rectangle gris. Le critère est « plusieurs échecs **et** aucune tuile
  chargée » — un seuil d'échecs seul ne se déclenchait jamais au zoom monde, où la carte
  ne demande que quatre tuiles ;
- **l'attribution est affichée.** Les deux cartes la désactivaient, alors que les tuiles
  dérivées d'OpenStreetMap la demandent.

Le fond vient d'OpenStreetMap, servi sans clé. Aucun fournisseur sans clé ne propose de
carte sombre, donc le moteur retourne les couleurs par un filtre CSS (`sombre: true`) :
un fond clair ferait une tache dans un jeu sombre.

`scripts/verifier.mjs` refuse toute source de tuiles écrite en dur dans une page ou un
module.

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
| `activite` | Le fil : `equipe_id` **ou** `joueur_cible` (contrainte `activite_cible`), `joueur_id`, `pseudo`, `type`, `enigme_index`, `contenu`, `reussie`, `created_at` |
| `parties` | `joueur_id`, `jeu_id`, `enigme_courante`, `resolues`, `indices_utilises`, `termine`, `updated_at` — unicité sur (`joueur_id`, `jeu_id`) |
| `tentatives` | `joueur_id`, `jeu_id`, `enigme_index`, `reussie`, `reponse` |
| `evenements` | `joueur_id`, `jeu_id`, `type`, `enigme_index`, `created_at` |
| `codes` | `code`, `jeu_id`, `label`, `actif`, `max_joueurs`, `expire_le`, `created_at` |
| `themes` | `id`, `name`, `colors` (dont `accent2`), `fonts`, `radius`, `glow`, `ambiance`, `titres`, `updated_at` |
| `admins` | `id` — la seule appartenance qui ouvre les fonctions serveur |
| `bibliotheque_enigmes` | `id`, `titre`, `categorie`, `tags`, `enigme`, `created_at` |
| `clients` | `id`, `nom`, `contact_nom`, `email`, `telephone`, `projet` (jsonb, la fiche projet), `note`, `statut`, `created_at`, `updated_at` |
| `questions` | `id` (slug), `section`, `libelle`, `aide`, `type`, `ingredient`, `options`, `ordre`, `actif` — le catalogue de questions |
| `questionnaires` | `id`, `client_id`, `nom`, `items` (jsonb : la sélection de questions et sa personnalisation), `mot_accueil` |
| `complices` | `id`, `questionnaire_id`, `nom`, `relation`, `jeton` (unique), `ouvert_le`, `termine_le` |
| `reponses` | `id`, `complice_id`, `question_id`, `libelle_pose`, `valeur`, `medias` (jsonb) — unicité sur (`complice_id`, `question_id`) |

### Les deux buckets de stockage

Un *bucket* est un espace de fichiers dans Supabase, l'équivalent d'un dossier servi par
une URL. Le projet en utilise deux, et la différence entre les deux est le point à
retenir :

| Bucket | Accès | Ce qu'on y met | Comment |
|---|---|---|---|
| `assets` | **public** — une URL devinable suffit à le lire | L'habillage d'un jeu : images d'énigmes, icônes, musique d'intro | Boutons ⇪ de l'éditeur, rangé par slug de jeu |
| `reponses` | **privé** — aucune URL permanente | Ce que les complices envoient | Leur lien de questionnaire ; n'en sort que par *Rendre public* |

Dans l'éditeur, tout s'envoie depuis la page — il n'y a jamais à passer par la console
Supabase. Les images utilisent `asset-upload` (compression côté navigateur, transit en
base64, quelques mégaoctets au plus) ; **les sons utilisent `asset-url`**, qui délivre une
URL signée pour un dépôt direct, parce qu'une musique d'intro de trois minutes ne tient
pas dans le corps d'une fonction serveur. Les deux calculent le chemin côté serveur :
l'extension vient du type MIME et non du nom envoyé, et un horodatage empêche tout
écrasement.

`statut` vaut `brouillon`, `publie` ou `archive`.

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

## Console de l'organisateur

Onglet **En direct** : les équipes en cours, et surtout le **temps sans progrès** — c'est
ce chiffre qui signale un blocage, pas le temps total. Il passe en rouge au-delà de dix
minutes. Sélectionner une équipe affiche son fil complet, alimenté en Realtime.

**Équipes et joueurs seuls figurent dans la même liste** et se pilotent pareil : seule
change la table qui porte la progression. `_suivi.js` résout la cible une fois
(`{ equipe_id }` → `parties_equipe`, `{ joueur_id }` → `parties`) pour que les fonctions
d'aide n'aient pas à dupliquer le branchement. Un joueur rattaché à une équipe est
toujours aidé **via son équipe**, sinon ses coéquipiers ne verraient rien passer.

Deux gestes d'aide, tous deux côté serveur :

- `aide-message` écrit une entrée `type: 'organisateur'` dans `activite`. La policy des
  joueurs leur interdit ce type : personne ne peut se faire passer pour l'organisateur.
- `aide-debloquer` écrit dans la table de progression. La logique de fusion du moteur
  fait avancer les téléphones concernés, et le geste est tracé dans le fil pour que les
  joueurs sachent qu'il vient de l'organisateur.

Côté joueur, `abonnerEquipe()` s'abonne au fil et à la progression **dans les deux
modes** : un joueur seul reçoit donc indices et déblocages sans recharger. Cela suppose
que `parties` soit dans la publication Realtime, ce que fait
[`supabase/migration-05-aide-solo.sql`](supabase/migration-05-aide-solo.sql).

⚠️ Un admin est dans `admins`, **pas dans `joueurs`** : les policies de la phase 2
l'excluent, et Realtime applique RLS par abonné. Sans
[`supabase/migration-03-console.sql`](supabase/migration-03-console.sql), la console ne
reçoit rien en direct.

## Statistiques et débrief

`stats.js` agrège désormais `tentatives` et `evenements` **en SQL**
([`supabase/migration-04-stats.sql`](supabase/migration-04-stats.sql)). Ces deux tables
grossissent à chaque geste de jeu : les charger en entier finissait par tronquer les
résultats sans le moindre signal. Les fonctions sont appelées avec la clé de service,
donc sans `security definer` et sans exposition nouvelle.

Le tableau de bord affiche les **mauvaises réponses les plus fréquentes**, collectées
depuis toujours dans `tentatives.reponse` et jusqu'ici affichées nulle part. Le
regroupement ignore casse et espaces. Une réponse qui revient signale rarement des
joueurs distraits : le plus souvent, l'énoncé est ambigu.

L'onglet **Débrief** reconstitue une partie — temps total, temps par acte, énigme la plus
coriace, indices, déroulé — pour l'équipe comme pour un joueur solo. Une feuille de style
d'impression ne laisse que le compte rendu sur le papier.

## Apparence de la console : clair et sombre

`admin.html` a **deux modes**, et un bouton à trois états en haut à droite :

| État | Attribut sur `<html>` | Effet |
|---|---|---|
| **Système** | aucun | `prefers-color-scheme` décide — la console suit le téléphone qui passe en sombre le soir |
| **Clair** | `data-theme="light"` | force le clair |
| **Sombre** | `data-theme="dark"` | force le sombre **même sur un système réglé en clair** |

La feuille est bâtie en **deux couches** : une palette brute (`--dk-*` / `--lt-*`) décrite
une seule fois, et les jetons de rôle (`--surface`, `--text`, `--border`…) remappés en
bloc. Aucun composant ne lit un `--dk-*` : pour retoucher une couleur, il n'y a qu'un
endroit.

> ⚠️ **La liste de remappage clair existe deux fois** — sous
> `@media (prefers-color-scheme:light)` et sous `[data-theme="light"]` — parce qu'une
> media query et un sélecteur d'attribut ne peuvent pas partager une règle en CSS nu.
> **Les deux listes doivent rester identiques.** C'est la seule duplication de la feuille,
> et elle est signalée en commentaire à l'endroit où elle vit.

**Le clair n'est pas blanc** (`#e8e5de`, un papier chaud) : la console sert aussi le soir
dans une pièce sombre, et un `#fff` à 22 h éblouit. L'accent cyan est conservé en sombre —
c'est l'identité — mais descend à `#00786e` en clair, où le cyan d'origine ne passe aucun
seuil de contraste.

Trois mécanismes à connaître avant d'y toucher :

- **`<meta name="color-scheme">` suit le mode**, réécrit par le JavaScript. Sans lui, les
  ascenseurs, les menus de `<select>` et le calendrier de `<input type="date">` restent
  sombres au milieu d'une page claire : le navigateur ne les peint pas d'après le CSS.
- **Un script dans le `<head>`** pose l'attribut avant le rendu. Appliqué plus bas, la
  page clignoterait en sombre avant de basculer.
- **`@media print` remappe les jetons** vers une palette papier plutôt que de repeindre
  chaque composant : le débrief s'imprime correctement même si la console est en sombre.

### Sur un téléphone

La console sert debout pendant l'événement, donc chaque écran doit y tenir. Sous 620 px,
les tables se **dépilent en cartes** : chaque ligne devient un bloc, chaque cellule une
rangée, et l'en-tête disparaît — le contenu se nomme lui-même (nom en gras, pastilles
d'état, boutons).

Avant, cinq tables exigeaient un défilement latéral : la liste des jeux demandait 756 px
pour 356 disponibles, le tableau de bord 814. Les boutons d'action vivaient hors de
l'écran. C'était ça, la sensation de « pas responsive » — pas un débordement de la page,
qui était nul partout.

`editeur.html` suit la même règle : sa barre du haut alignait sept éléments dans une
rangée qui ne passait jamais à la ligne et débordait de 248 px. Elle se replie
maintenant, le nom du projet sur sa propre ligne.

**Les polices sont celles du système**, et c'est un choix : `system-ui` rend SF Pro sur
Mac, Segoe UI Variable sur Windows — la police d'interface dessinée pour la machine, avec
son hinting, affichée instantanément. La pile monospace va chercher les modernes d'abord
(SF Mono, Cascadia, JetBrains Mono, IBM Plex Mono si installées) puis Consolas et Menlo.
Rien n'est téléchargé : aucune requête externe sur la page qui porte la session admin.

Le détail des décisions de la refonte est dans
[`design/admin-design-kit/NOTE-REFONTE.md`](design/admin-design-kit/NOTE-REFONTE.md).

## Themes

Un theme pilote le moteur par variables CSS (`applyTheme`, `public/index.html`) :
10 couleurs, 3 polices, un rayon, un halo, une profondeur de fond et le caractere des
titres.

**Le rayon commande toute une echelle.** `--radius` est la seule valeur reglee par le
theme ; `--r-xs` a `--r-xl` en derivent par calcul. Les 46 `border-radius` du moteur
etaient auparavant codes en dur et le curseur de l'editeur ne servait a rien.

**`ambiance`** dose la profondeur du fond (`aucune` / `discrete` / `marquee`) : une
lueur radiale teintee par les deux accents et une vignette, posees sur `body::before`
et `::after`. Un aplat uni est le marqueur le plus reconnaissable d'un theme fait
maison.

**`colors.accent2`** sert aux degrades et aux lueurs. Les themes qui n'en declarent pas
retombent sur l'accent principal — rien ne change pour eux.

**`titres`** (`poids`, `casse`, `interlettrage`) evite que deux themes partageant une
police se ressemblent.

Cote editeur : quatre points de depart (neon, mineral, papier, chaleureux), un controle
de contraste WCAG qui signale les paires illisibles avec leur ratio, et un apercu qui
rend les vrais ecrans du jeu — hub, carte d'enigme, champ de reponse — avec **les memes
derivations que `applyTheme()`**. Toute modification de l'un doit etre repercutee dans
l'autre, sinon l'apercu ment.

Migration : [`supabase/migration-06-themes.sql`](supabase/migration-06-themes.sql).

## Clients et catalogue de questions

Un jeu sur mesure se prépare avant de s'écrire. Deux écrans d'`admin.html` servent cette
préparation.

**Clients** porte la fiche de chaque client : contact, statut commercial, et une **fiche
projet** (`clients.projet`, jsonb) qui rassemble l'événement, le format, les lieux, les
contraintes et le budget. Elle reste entre l'organisateur et le client — rien de ce qui
s'y trouve n'est destiné à être partagé. Les jeux s'y rattachent par `jeux.client_id` ;
l'ancien champ texte `jeux.client` n'est pas touché et sert de repli, si bien que les
jeux d'avant remontent comme « orphelins » à rattacher en un clic.

**Catalogue de questions** est la réserve dans laquelle on pioche pour composer le
questionnaire d'un client : une soixantaine de questions réparties en sections
(identité, personnalité, goûts, sport, enfance, histoire, chiffres, lieux, médias, ton),
enrichissable.

Chaque question déclare un **`ingredient`** : ce que sa réponse produira comme matière
d'énigme. C'est le champ qui fait la différence entre un formulaire et un outil de
conception.

| Ingrédient | Ce qu'on en fait |
|---|---|
| `chiffre` | cadenas à molettes, clavier numérique, codes |
| `mot` | réponse texte, mots mêlés, anagramme |
| `lieu` | énigme GPS, guess-where |
| `media` | image d'énigme, lampe UV |
| `liste` | QCM, associations, rébus |
| `recit` | narration, indices, ton du jeu |

L'`id` d'une question est un slug dérivé de son libellé **puis figé** : le changer
orphelinerait les réponses déjà collectées. Retirer une question la désactive par
défaut, pour la même raison ; la suppression définitive n'est proposée que sur une
question déjà inactive.

Les deux tables ont RLS activée **sans aucune policy** : elles ne sont accessibles que
par les fonctions serveur à clé de service, toutes derrière `requireAdmin`.

Migration : [`supabase/migration-07-clients.sql`](supabase/migration-07-clients.sql).

## Questionnaires et complices

Un **questionnaire** est une sélection de questions du catalogue, personnalisée pour un
client. Un client peut en avoir plusieurs : celui du conjoint n'est pas celui des
collègues de bureau.

Chaque question retenue peut être **reformulée** (pour tutoyer le complice et nommer les
personnes), **pré-remplie** (ce que l'organisateur sait déjà) et marquée **obligatoire**.
L'ordre d'affichage est celui du catalogue — `section`, puis `ordre` — plutôt qu'un
glisser-déposer par questionnaire : l'ordre appartient au catalogue, où il est réglé une
fois pour toutes les fois où la question resservira.

### Le lien du complice

Chaque complice reçoit **son propre** lien, `repondre.html?jeton=…`. Un jeton par
complice et non un par questionnaire : on sait ainsi qui a répondu quoi, qui n'a pas
ouvert son lien, et on peut en révoquer un — l'action *Révoquer* tire un nouveau jeton,
l'ancien cesse de marcher, les réponses restent — sans couper les autres.

Le jeton **est** l'authentification : un complice n'a pas de compte, et lui en faire
créer un le ferait abandonner avant la première question. Il est donc tiré au sort côté
serveur sur 24 octets (192 bits).

`public/repondre.html` est la page la plus exposée du site : un lien circule par SMS, se
transfère, se retrouve dans un groupe. Elle ne porte donc **aucune clé Supabase, aucun
client, aucune requête** — seulement trois appels aux fonctions publiques
`repondre-charger`, `repondre-enregistrer` et `repondre-terminer`, qui la cadrent sur son
seul jeton. `scripts/verifier.mjs` vérifie les deux moitiés de cette règle : qu'aucune
fonction `repondre-*` n'oublie `resoudreJeton`, et que la page ne touche jamais la base
directement.

Ce qui ne sort jamais vers un complice : la fiche projet du client, ses coordonnées, et
les réponses des autres complices. Seul le nom du client sort, pour que la page puisse
dire pour qui c'est.

### Enregistrement

Le complice répond sur son téléphone, entre deux choses. Chaque champ s'enregistre seul,
une seconde après la dernière frappe, et à la sortie du champ ; un `sendBeacon` rattrape
ce qui partirait à la fermeture de l'onglet.

**Une valeur pré-remplie n'est pas une réponse** tant que personne ne l'a confirmée :
elle s'affiche dans le champ mais ne part pas en base. Le bouton *J'ai fini* est
précisément le geste par lequel le complice dit avoir tout relu — c'est donc là que ces
valeurs deviennent des réponses. *J'ai fini* est un signal, pas un verrou : le lien
continue de fonctionner, pour qui se souvient d'un détail trois jours plus tard.

### Ce que l'organisateur en récupère

Sous la fiche client, le panneau **Matière collectée** regroupe les réponses **par
ingrédient** et non par section : au moment de construire une énigme on cherche « un
chiffre », pas « quelque chose sur l'enfance ».

`reponses.question_id` n'a **volontairement pas** de clé étrangère vers `questions` : une
réponse est de la matière déjà collectée, parfois irremplaçable, et la perdre parce que
la question a quitté le catalogue serait le pire des défauts. Le libellé exact tel qu'il
a été posé est copié dans `reponses.libelle_pose`, pour que la réponse reste lisible même
si la question change ou disparaît. Les garde-fous correspondants sont côté serveur :
supprimer définitivement une question, un questionnaire ou un complice est refusé tant
que des réponses y font référence.

Migration : [`supabase/migration-08-questionnaires.sql`](supabase/migration-08-questionnaires.sql).

## Photos et sons des complices

Une question de type `media` demande une photo, pas une phrase : la photo du voyage, le
faire-part, l'enregistrement d'une voix. `reponses.valeur` garde la description en texte,
`reponses.medias` la liste des fichiers.

### Deux buckets, et un seul geste pour passer de l'un à l'autre

Ce que les complices envoient arrive dans le bucket **`reponses`, privé**. Le bucket
`assets` est **public** : une URL devinable y suffit à tout lire. Des photos de famille
confiées pour une surprise n'y ont rien à faire.

Le passage de l'un à l'autre est un geste d'administrateur, **fichier par fichier**
(bouton *Rendre public*, fonction `media-promouvoir`), une fois qu'on sait que la photo
servira dans une énigme. Il n'arrive jamais tout seul : ni à l'envoi, ni à la
consultation. La promotion est une **copie** — l'original reste dans le bucket privé,
pour que retirer la photo du jeu plus tard ne fasse pas disparaître la matière
collectée. `scripts/verifier.mjs` refuse toute autre fonction qui écrirait dans
`assets`.

Dans l'admin, les aperçus passent par des **URL signées d'une heure**
(`media-lire`) : un bucket privé n'a pas d'URL permanente, et rien ne reste
partageable ensuite par inadvertance.

### Comment le fichier arrive

Le navigateur du complice ne dépose pas à travers une fonction serveur — une photo de
téléphone pèse plusieurs mégaoctets. `repondre-media-url` délivre une **URL signée**
valable quelques minutes, le navigateur `PUT` le fichier directement dans Supabase, puis
`repondre-media-confirmer` le rattache à la réponse.

Ce que le navigateur **ne décide pas** :

- **le chemin**, entièrement calculé côté serveur (`<complice>/<question>/<aléatoire>`),
  donc aucun envoi n'écrase celui d'un autre ni ne sort du dossier du complice ;
- **l'extension**, déduite du type MIME déclaré et non du nom de fichier — un
  `photo.jpg.html` n'a alors aucune prise ;
- **l'existence du fichier** : la confirmation vérifie auprès du stockage que l'objet est
  bien là et fait bien le poids, sinon `medias` se remplirait de chemins inventés.

Limites : **20 Mo** par fichier, **5 fichiers** par question, et une liste blanche
d'images et de sons. Pas de `image/svg+xml` — un SVG est un document exécutable, et rien
dans une photo de famille n'en a besoin. Pas de vidéo : le poids change la nature du
problème et aucune énigme n'en demande. Les règles vivent dans
`netlify/functions/_medias.js`, en un seul endroit parce qu'elles sont appliquées sur
deux chemins ; `tests/medias.test.mjs` les couvre.

Migration : [`supabase/migration-09-medias.sql`](supabase/migration-09-medias.sql) — elle
crée le bucket privé et ajoute `reponses.medias`.

## Des réponses à l'énigme

Bout de chaîne : le questionnaire collecte, l'énigme consomme. Dans `editeur.html`, le
bouton **🧩** ouvre le panneau **Ingrédients du client** — les réponses des proches,
groupées par ce qu'on peut en fabriquer, avec le compte affiché sur le bouton.

Le panneau reste ouvert pendant qu'on écrit : c'est un plan de travail, pas un
diagnostic. *Insérer* place la valeur **au curseur du dernier champ où l'on écrivait**,
rappelé en haut du panneau — sans ce rappel, cliquer dans le panneau fait perdre le focus
et l'insertion devient un pari.

L'insertion passe par un événement `input` et non par une écriture directe dans `CFG` :
chaque champ de l'éditeur porte son propre gestionnaire (`onInput`, `onTextarea`,
`onBoundsInput`…), et le contourner ferait diverger l'écran de la configuration.

Seuls les **médias promus** sont insérables, et c'est le point : un chemin du bucket privé
dans une énigme afficherait une image que les joueurs ne peuvent pas lire. Le panneau
signale les fichiers encore en attente de promotion plutôt que de les proposer.

Le bouton reste visible même sans fiche client rattachée — il explique alors comment
rattacher le jeu, parce qu'un panneau vide se lit comme une panne.

`jeu-get` renvoie `client_id` **hors de `config`** : ce n'est pas du contenu de jeu et ça
ne doit pas partir dans le `config.json` exporté.

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
seules fonctions publiques sont `manifest`, `code-resolve`, `rejoindre`, `jeux-publics`
et les trois `repondre-*`. Ces dernières n'ont pas d'administrateur à vérifier — leur
appelant est un complice sans compte — mais elles ne sont pas pour autant ouvertes :
`resoudreJeton` les cadre toutes sur le seul questionnaire du jeton présenté, et le
vérificateur refuse toute fonction `repondre-*` qui l'omettrait.

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

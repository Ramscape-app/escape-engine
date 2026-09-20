# Note de refonte — console d'administration Escape Engine

Livrable : `css/admin.css` (feuille complète, modes clair et sombre), `atelier.html`
(bouton de thème câblé sur trois états), et `mockups/` — six écrans de la console rendus
avec la nouvelle feuille, dans les deux modes et aux deux largeurs.

Aucun nom n'a disparu : les 42 jetons, les 127 classes et les `id` cités par le CSS sont
tous là, aux mêmes noms. `src/admin.html` n'a pas été touché. Les `.tpv-*` sont reprises
à l'identique, seule la grille `.tpv` qui les contient a bougé.

---

## 1. La palette : deux couches, une seule source

Le problème n'était pas les valeurs sombres, c'était qu'elles étaient **posées
directement sur les jetons de rôle**. Un mode clair demandait donc de réécrire 42 valeurs
à deux endroits, et les `rgba()` codés en dur dans les composants (`rgba(255,77,109,.3)`
sur `.pill.off`, `rgba(255,255,255,.14)` sur les pastilles de couleur) restaient sombres
quoi qu'il arrive.

D'où deux couches :

- **`--dk-*` / `--lt-*`** : la palette brute, décrite une fois, tout en haut. Aucun
  composant ne la lit.
- **les 42 jetons de rôle** (`--surface`, `--text`, `--border`…) : remappés en bloc, trois
  fois — sombre par défaut, clair sous `@media (prefers-color-scheme:light)`, clair sous
  `[data-theme="light"]`.

Pour changer une couleur, un seul endroit à toucher. **Seule duplication du fichier** : la
liste de remappage clair existe deux fois (§2b et §2c), parce qu'une media query et un
sélecteur d'attribut ne peuvent pas partager une règle en CSS nu. Les deux listes doivent
rester identiques ; c'est signalé en commentaire dans le fichier.

**Les trois états du bouton.** `data-theme="light"` force le clair, `data-theme="dark"`
force le sombre *même sur un système réglé en clair* (c'est le
`:root:not([data-theme="dark"])` de la media query qui le permet), et l'absence
d'attribut rend la main à `prefers-color-scheme`. L'atelier fait tourner les trois ;
l'application n'a besoin de poser que l'attribut.

`color-scheme` est déclaré en parallèle du mode. Sans lui, les ascenseurs, les menus de
`<select>` et le calendrier de `<input type="date">` restent sombres au milieu d'une page
claire — c'est le même oubli de famille que le `textarea` manquant.

**Le clair n'est pas blanc.** `--lt-bg:#e8e5de`, surfaces à `#f6f4ef` : un papier chaud.
La console sert le soir dans une pièce sombre ; un `#fff` à 22 h éblouit et écrase
l'accent. Les surfaces conservent la hiérarchie du sombre (fond plus profond que les
cartes) inversée : le fond est un cran plus gris que les cartes, qui se détachent donc
sans ombre, exactement comme en sombre.

**L'accent descend en clair.** `#00e0d0` est conservé en sombre — c'est l'identité — mais
passe à `#00786e` en clair : le cyan d'origine ne passe aucun seuil de contraste sur
papier, ni en texte ni en fond de bouton. Même logique pour `--ok`, `--warn`, `--danger`
et les six teintes d'ingrédient, qui ont chacune une version « encre » lisible sur clair.

**Jetons ajoutés** (rien de supprimé) : `--accent-2` (le dégradé du logo), `--field` /
`--field-bd` (le fond des champs, qui doit pouvoir être plus clair que la carte en mode
clair et plus sombre en mode sombre), `--ok-line` / `--warn-line` / `--danger-line` (les
filets, ex-`rgba()` en dur), `--overlay`, `--shadow`, `--ing-1…6`.

---

## 2. Typographie : trois rangs qui se lisent comme trois

Les niveaux étaient à `1.25rem` / `1rem` / `0.88rem` — trois valeurs trop proches, toutes
en `600`. Ils sont maintenant :

| Rang | Avant | Après | Signe distinctif |
|---|---|---|---|
| Titre de page (`h2`) | 1.25rem / 600 | **1.375rem / 650**, `-0.022em` | filet de `.page-head` |
| Titre de section (`.section-head h3`) | 1rem / 600 | **1.0625rem / 600** | **filet sous le titre** |
| Titre de carte (`h3`) | 0.88rem / 600 | 0.875rem / 600 | aucun filet |

Le filet sous `.section-head` fait plus pour la hiérarchie que n'importe quel écart de
taille : il donne un rang intermédiaire visible même quand la section est vide.

**Le changement le plus payant : les libellés de champ quittent le monospace majuscule.**
Sur la fiche client, 22 libellés en petites capitales espacées coûtaient plus de lecture
qu'ils n'en structuraient — c'est ce qui donnait à la console son air de panneau de
contrôle plutôt que d'outil de travail. Ils sont maintenant en sans-serif 12 px, `500`,
casse normale, en `--dim`.

Le monospace majuscule **reste** là où il désigne une structure, pas un contenu :
`.eyebrow`, `.navgroup`, les en-têtes de tableau, `.cphead`, `.cpsec h4`, `.ctrhead`,
`.count`, les libellés de `.kpi` et l'heure des `.filrow`. Il y gagne en sens.

Les chiffres sont en `tabular-nums` partout où ils s'empilent (`.kpi`, `.dbstat`,
`.scard .stat`, `.ctr`, `.meta`).

---

## 3. Densité : la fiche client

`.projetgrid` passe de colonnes de 200 px à **170 px** : sur un écran de bureau la fiche
tient sur trois à quatre colonnes au lieu de deux, et le formulaire de 22 champs cesse
d'être un ruban. L'espacement vertical se resserre (libellé à 5 px du champ), l'horizontal
s'ouvre (`--s4` entre colonnes) : deux champs voisins ne se lisent plus comme un seul.
Les `textarea` gardent leur pleine largeur ; sous 760 px la grille passe à deux colonnes,
et les `textarea` reprennent toute la ligne via `:has(textarea)`.

Le gain réel vient surtout des libellés allégés (§2) : à densité égale, la fiche est
balayable.

---

## 4. Les deux écrans difficiles

**Le compositeur (`.modalbox.large`).** Trois changements :

1. `.cplist` était écrasé par le `flex-shrink` de la fenêtre bornée à 86 vh — la liste
   pouvait tomber à une ligne. Elle est maintenant `flex:1 1 auto` avec `min-height:210px`
   et `max-height:min(52vh,460px)`.
2. **`.cpsec h4` est collant** : le nom de la rubrique reste visible pendant qu'on fait
   défiler ses questions. Sur 70 lignes, c'est ce qui évite de cocher dans la mauvaise
   rubrique.
3. **La ligne cochée porte une gouttière d'accent** (bordure gauche de 2 px). On retrouve
   ses 24 sélections en balayant le bord gauche, sans lire. `.cpdetail` est séparé par un
   pointillé et reste aligné sur le libellé ; sur téléphone il revient à la marge et les
   cases passent à 22 px.

**Le suivi en direct (`.livegrid`).** C'est l'écran consulté debout, dans l'urgence :

- `bloquée 14 min` n'est plus du petit texte rouge mais une **pastille** rouge cerclée —
  la seule information qu'on cherche à bout de bras.
- `.eqbar` passe de 4 à 6 px, `.eqcard` gagne du padding, le titre passe au rang
  supérieur sous 760 px.
- Sous 760 px, `.filbox` devient une colonne flex bornée à la hauteur d'écran : le fil
  défile seul et **`.aidebox` reste collé en bas**, donc le champ de message et le bouton
  « Débloquer » sont toujours sous le pouce.
- L'heure des `.filrow` est en gouttière de largeur fixe (`5ch`) : l'œil suit une colonne
  au lieu de chercher le début de chaque ligne.

---

## 5. Les états vides, les tableaux, l'accent

**`.state`** revient sur tous les écrans, et c'est lui qui donne la sensation générale. Il
devient une **zone identifiable** : hachures très basses, cadre pointillé en retrait,
texte à 14 px borné à 46 caractères, centré. `::first-line` passe la première ligne du
gabarit (« Aucun client. ») en demi-gras là où le navigateur l'accepte — amélioration
progressive, rien n'en dépend.

**Les tableaux** gardent leur structure et gagnent un en-tête assumé (fond `--surface-2`,
filet `--border-hi`, monospace espacé), des lignes à hauteur régulière (11 px), une
dernière colonne d'actions en `nowrap`, et des boutons compacts dans les cellules. Sur
téléphone, seuls les conteneurs listés gardent le défilement horizontal — la règle
d'origine, conservée telle quelle.

**L'accent : la règle des trois usages tient, à une exception près.** Action primaire,
onglet actif, focus — c'est juste, et du cyan partout dilue. L'exception ajoutée :
`.filrow.orga`, où l'accent distingue la voix de l'organisateur dans le fil. Tout le
reste des états passe par `--ok`, `--warn`, `--danger` et les six teintes d'ingrédient.
Le survol reste neutre.

---

## 6. Envisagé, puis écarté

- ~~Une police Google Fonts.~~ **Retenue, après accord : IBM Plex Sans + IBM Plex Mono**
  (SIL OFL). Trois raisons : une chasse fixe assortie — en-têtes de tableau, heures du
  fil, compteurs et chiffres partagent enfin une seule famille, ce qui est la moitié du
  travail de hiérarchie ; des diacritiques françaises réellement dessinées ; un caractère
  d'outil technique plutôt que de site web. Le corps de base passe de 14 à 13,5 px —
  l'œil de Plex est plus grand, la hauteur apparente est identique.
  La feuille embarque un `@import`, qui suffit et garde le fichier autonome ; **dans
  l'application, préférer un `<link>` + `preconnect` dans le `<head>`** (un `@import`
  bloque le rendu le temps du téléchargement). Les deux lignes sont en commentaire en
  tête de `admin.css`. Sans réseau, les polices système restent en secours.
- **Renommer / fusionner des classes.** Écarté par principe : les 40 gabarits JS émettent
  les anciens noms et la moitié de la console perdrait son style sans erreur visible.
- **Passer les cartes à l'ombre portée plutôt qu'au filet.** Écarté : le rapport
  fond/surface fait déjà le travail dans les deux modes, et les ombres se comportent mal
  sur papier chaud. L'ombre ne sert qu'aux fenêtres modales, où elle dit « au-dessus ».
- **Densifier davantage `.filrow` et les lignes de tableau.** Écarté : « plusieurs heures
  d'affilée » et « à bout de bras » commandent l'inverse. Les cibles tactiles passent au
  contraire à 44 px sous 760 px.
- **Un troisième thème de console (sépia / nuit profonde).** Écarté pour l'instant : la
  structure le permettrait en ajoutant une couche `--sp-*` et un bloc de remappage, mais
  deux modes bien réglés valent mieux que trois approximatifs.

## 7. Les décisions d'origine que je n'ai pas défaites

Le ménage précédent était bon et je l'ai gardé : une seule échelle d'espacement, quatre
rayons, une fondation de carte unique, `.btn.inline` plutôt que des `width:auto` inline,
le `min-width:520px` des tables réservé aux conteneurs défilables, le motif
liste-à-gauche / fiche-à-droite partagé entre clients et direct. Les commentaires qui
expliquaient ces choix sont conservés et complétés, jamais remplacés.

Deux remarques en retour :

1. **`--t-micro` (11 px) était utilisé pour du contenu**, pas seulement pour des
   étiquettes : `.help` et `.hint` à 12 px sur `--faint` passaient tout juste le seuil de
   contraste en sombre, et pas du tout ce qu'on voudrait pour « plusieurs heures
   d'affilée ». `--faint` a été remonté dans les deux modes, et `.hint` est passé à
   `--dim`.
2. **`.state` sortait du système** : `padding` en `--s7`/`--s5` mais aucun cadre, aucune
   taille propre. C'était la classe la plus vue de la console et la moins définie.

## 8. Impression du débrief

Plutôt que de repeindre chaque composant en noir et blanc, `@media print` **remappe les
jetons de rôle** vers une palette papier — tout le reste suit, y compris si la console est
en mode sombre au moment de l'impression. Ajouts : `break-inside:avoid` sur les cartes et
les sections, filet double sous `.page-head`, en-têtes de tableau grisés, boutons et
navigation masqués comme avant.

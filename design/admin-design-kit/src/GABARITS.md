# Où vit le HTML

> Généré depuis `public/admin.html`. C'est **le** point à comprendre avant de toucher au
> visuel de cette console.

`admin.html` est un fichier unique, sans étape de build ni framework. Son HTML statique ne
contient que la coquille : barre du haut, navigation, et un conteneur vide par écran.

**Tout le reste est produit à l'exécution**, par les Fonctions qui produisent du markup : 40 fonctions ci-dessous, qui
assemblent des chaînes de gabarit (`` `<div class="...">` ``) et les posent dans un
`innerHTML`.

Conséquence pour le design : une classe renommée dans le HTML statique laisse derrière
elle des dizaines de gabarits qui émettent encore l'ancienne. **C'est pourquoi on travaille
sur `atelier.html` et `css/admin.css`, jamais sur ce fichier-ci.** Il est là pour
comprendre la structure et les enchaînements, pas pour être modifié.

## Les fonctions, et les classes que chacune émet

| Fonction | Classes produites |
|---|---|
| `updatePreview` | `done` `ko` `now` `ok` `tpv` `tpv-acte` `tpv-amb` `tpv-bar` `tpv-card` `tpv-cards` `tpv-eyebrow` `tpv-fb` `tpv-hint` `tpv-in` `tpv-input` `tpv-logo` `tpv-narr` `tpv-q` `tpv-screen` |
| `composer` | `btn` `cphead` `cplist` `cpsec` `field` `formrow` `help` `inline` `large` `modalact` `modalbox` `sub` `tog` |
| `renderFiche` | `btn` `createbox` `del` `field` `formrow` `inline` `pill` `projetgrid` `section-head` `state` `sub` `tog` |
| `renderDebrief` | `dbgrid` `dbsec` `dbstat` `filbox` `fillist` `filrow` `h` `scard` `stat` `state` `sub` |
| `renderCatalogue` | `count` `del` `pill` `section` `section-head` `state` `tablecard` `tablescroll` `tog` |
| `formulaireQuestion` | `btn` `field` `formrow` `help` `inline` `modalact` `modalbox` `sub` `tog` |
| `renderDetail` | `aidebox` `filbox` `fillist` `filrow` `h` `pill` `row` `state` `tog` |
| `renderContraste` | `ctr` `ctrbox` `ctrhead` `lb` `off` `ok` `p` `pill` `vd` |
| `montrerProblemes` | `ale` `del` `err` `modalact` `modalbox` `pbgrp` `pbs` `sub` `tog` |
| `blocMediaAdmin` | `apercu` `help` `mediaitem` `medialist` `mediameta` `ok` `pill` `tog` |
| `ligneCompose` | `cpdetail` `cpobl` `cprow` `cptop` `formrow` `help` `pill` |
| `loadMatiere` | `count` `createbox` `help` `matsec` `pill` `section-head` `sub` |
| `renderLive` | `eqbar` `eqcard` `hint` `meta` `ok` `pill` `state` |
| `renderQuestionnaires` | `btn` `createbox` `inline` `section-head` `state` `sub` |
| `blocQuestionnaire` | `del` `formrow` `pill` `qnbloc` `qnhead` `tog` |
| `renderCodes` | `del` `off` `ok` `pill` `state` `tog` |
| `renderJeux` | `off` `ok` `pill` `state` `tog` |
| `renderOverview` | `bar` `off` `ok` `pill` `state` |
| `rowHtml` | `del` `off` `ok` `pill` `tog` |
| `renderClients` | `clicard` `meta` `pill` `state` |
| `loadRecap` | `scard` `stat` `state` |
| `etatComplice` | `off` `ok` `pill` |
| `renderBiblio` | `del` `state` `tog` |
| `renderThemesList` | `dot` `state` `themeitem` |
| `renderPresets` | `d` `preset` `swatches` |
| `loadQuestionnaires` | `createbox` `state` |
| `loadClients` | `state` |
| `loadCatalogue` | `state` |
| `loadDebrief` | `state` |
| `loadLive` | `state` |
| `loadBiblio` | `state` |
| `loadCodes` | `state` |
| `loadThemesLib` | `state` |
| `buildColorInputs` | `colorrow` |
| `loadStats` | `state` |
| `renderBlocages` | `state` |
| `renderMauvaises` | `state` |
| `renderThemeUsage` | `state` |
| `loadJoueurs` | `state` |
| `render` | `state` |

## Comment lire ce tableau

- **`updatePreview`** produit les `.tpv-*`, l'aperçu de thème. Il reproduit les vrais
  écrans du jeu avec **les mêmes dérivations que `applyTheme()`** dans `index.html`. Un
  aperçu qui ne correspond pas au résultat ne sert à rien : à modifier avec précaution,
  et jamais dans sa structure.
- **`composer`** et **`ligneCompose`** forment le compositeur de questionnaire, la
  fenêtre la plus dense de la console — c'est le meilleur test d'une proposition de
  densité.
- **`state`** revient partout : c'est le message « rien à afficher » de chaque écran. Le
  soigner change la sensation générale plus que n'importe quel autre composant.
- **`renderFiche`** est le plus long formulaire (une fiche client de 22 champs) : c'est
  là que se juge la tenue d'une grille de formulaire.

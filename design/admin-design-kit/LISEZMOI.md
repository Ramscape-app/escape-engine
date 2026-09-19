# Kit de design — console d'administration Escape Engine

Bonjour. Ce dossier contient tout ce qu'il faut pour proposer une refonte visuelle de la
console d'administration d'une plateforme d'escape games sur mesure.

**Ce qu'on attend de toi : une recommandation, pas une livraison intégrable.** Le résultat
sera repris à la main dans l'application. Tu peux donc proposer franchement, sans te
brider pour rester compatible — mais lis la section « Le piège » avant de décider où
intervenir.

---

## Ce qu'est cette application

Un artisan fabrique des escape games personnalisés pour des particuliers et des
entreprises : un mariage, un anniversaire, un départ à la retraite. Il utilise cette
console pour **tout** : tenir les fiches de ses clients, composer les questionnaires
qu'il envoie à leurs proches, écrire les énigmes, suivre la soirée en direct depuis son
téléphone, et sortir un débrief après coup.

Ce n'est pas un produit SaaS avec des milliers d'utilisateurs. **Il y a un seul
utilisateur, et il y passe des heures.** C'est ce qui doit guider les choix : lisibilité
sur la durée, densité d'information assumée, rien de décoratif qui coûte un clic.

Les moments où elle sert vraiment :

- **En préparation**, au bureau, plusieurs heures d'affilée. Beaucoup de formulaires,
  beaucoup de lecture.
- **Pendant l'événement**, debout, sur un téléphone, dans une pièce sombre, pendant que
  des joueurs attendent. Là il faut voir en un coup d'œil quelle équipe est bloquée.
- **Après**, pour montrer un débrief au client. Ça s'imprime.

## Contraintes techniques, non négociables

| Contrainte | Pourquoi |
|---|---|
| **Aucune bibliothèque, aucun framework** | Pas d'étape de build. Le site est fait de fichiers HTML statiques servis tels quels. Pas de Tailwind, pas de React, pas de composants. |
| **Aucun script externe supplémentaire** | La page porte la session d'authentification de l'administrateur. |
| **CSS écrit à la main**, dans un `<style>` | Sass, PostCSS, `@apply` : rien de tout ça ne peut tourner ici. |
| **Polices système uniquement** | Une police Google Fonts est envisageable mais doit être demandée explicitement, pas supposée. |
| **Tout doit tenir sur un téléphone** | Voir ci-dessus : la console sert debout, pendant l'événement. |

## Le piège, et la raison du découpage de ce dossier

`src/admin.html` fait 2 700 lignes. **L'essentiel de son HTML n'existe pas dans le
fichier** : il est produit à l'exécution par 40 fonctions JavaScript qui assemblent des
chaînes de gabarit. Une classe renommée dans le HTML statique laisse derrière elle des
dizaines de gabarits qui émettent encore l'ancienne, et la moitié de la console perd son
style sans qu'aucune erreur n'apparaisse.

`src/GABARITS.md` donne le tableau complet : quelle fonction produit quelles classes.

**Donc : travaille sur `atelier.html` et `css/admin.css`.** `src/admin.html` est là pour
comprendre la structure et les enchaînements, pas pour être modifié.

---

## Le dossier

```
LISEZMOI.md          ← ce fichier : le brief
CONTRAT.md           ← l'inventaire figé : 127 classes, 117 ids, 42 jetons (généré)
atelier.html         ← ★ la page de travail : tous les composants, tous les états
css/admin.css        ← ★ la feuille de style, extraite telle quelle de l'application
captures/            ← l'état actuel, rendu dans un vrai navigateur
src/admin.html       ← l'application réelle, pour référence (identifiants retirés)
src/GABARITS.md      ← quelle fonction JS produit quel markup
```

Ouvre `atelier.html` dans un navigateur : tout s'affiche, sans serveur ni installation.
Il affiche **toutes** les classes stylées de l'application — c'est vérifié par un script,
pas par bonne volonté.

---

## Ce qu'on te demande

### 1. Le mode clair — c'est la demande principale

La console est aujourd'hui **sombre en dur** : les jetons portent directement des valeurs
sombres. On veut les deux modes, et proprement.

Le bouton ☀︎/☾ en haut de l'atelier pose déjà `data-theme="light"` sur `<html>`. **Il ne
fait rien d'autre** : la feuille n'a aucune règle pour le clair. C'est le crochet à
câbler.

La structure attendue, à ajuster si tu vois mieux : une couche de palette, puis des
jetons de rôle (`--surface`, `--text`, `--border`…) redéfinis sous
`@media (prefers-color-scheme: light)` **et** sous `[data-theme="light"]`, pour que le
réglage système et le bouton manuel fonctionnent tous les deux.

Le mode clair doit rester utilisable **le soir, dans une pièce sombre** : pas de blanc pur
qui brûle les yeux.

### 2. Rendre l'ensemble plus professionnel

C'est volontairement large. Quelques pistes, tu n'es pas tenu de les suivre :

- **La hiérarchie typographique.** Il y a des titres de page, de section, de carte, et
  des sur-titres en monospace. Est-ce que ça se lit vraiment comme trois niveaux ?
- **La densité.** Un écran comme la fiche client aligne 22 champs. Est-ce qu'on peut le
  rendre balayable sans le rendre plus grand ?
- **L'accent.** Il est aujourd'hui limité à trois usages — action primaire, onglet actif,
  focus — parce que le mettre partout le diluait. À toi de dire si cette règle tient ou si
  elle mérite d'être desserrée.
- **Les états vides.** La classe `.state` (« Aucun client, crée le premier… ») revient sur
  tous les écrans. La soigner change la sensation générale plus que n'importe quel autre
  composant.
- **Les tableaux.** Cinq écrans en dépendent. Ils sont fonctionnels et sans caractère.

### 3. Ce qui mérite d'être regardé de près

Les deux écrans les plus difficiles, et donc les plus révélateurs :

- **Le compositeur de questionnaire** (`.modalbox.large` dans l'atelier) : une fenêtre
  avec une liste défilante de 70 questions à cocher, chacune dépliant trois champs. C'est
  le pire cas de densité de toute l'application.
- **Le suivi en direct** (`.livegrid`) : liste d'équipes à gauche, fil d'événements en
  temps réel à droite. C'est l'écran consulté debout, sur téléphone, dans l'urgence.

### 4. Ce à quoi il ne faut PAS toucher

Les classes **`.tpv-*`** reproduisent les écrans du jeu pour prévisualiser un thème. Elles
doivent refléter exactement ce que fait le moteur de jeu (`applyTheme()`), qui n'est pas
dans ce dossier. **Un aperçu qui ne correspond pas au résultat ne sert à rien.** Tu peux
améliorer leur mise en page dans la grille, pas leur structure interne ni leurs couleurs —
celles-ci viennent des variables `--pv-*`, injectées par le JavaScript.

---

## Comment livrer

Idéalement **deux choses** :

1. **`css/admin.css` modifié**, avec les modes clair et sombre. C'est ce qui sera repris.
2. **Une note courte** sur les décisions prises et pourquoi : ce qui a changé dans
   l'échelle typographique, la logique de la palette, ce que tu as écarté. C'est cette
   note qui permet de reprendre la main plus tard sans défaire ton travail par ignorance.

Si tu veux aller plus loin et proposer une maquette qui s'écarte de la structure actuelle,
fais-le **en plus**, dans un fichier séparé. La proposition sera lue ; elle ne remplacera
pas le point 1.

**Une seule chose à respecter absolument** : les **noms** listés dans `CONTRAT.md` — les
classes, les `id`, les jetons. Leurs **valeurs** sont entièrement à toi. Un `id` disparu ne
produit aucune erreur visible : la fonction JavaScript s'arrête, et le bouton ne fait plus
rien. C'est le seul dégât qu'on ne voit pas venir.

---

## Une note sur l'état actuel

La feuille a déjà été assainie une fois : elle comptait 24 tailles de police et 11 rayons
différents, chaque ajout inventant ses propres valeurs. Les 42 jetons de `:root` sont le
résultat de ce ménage. Les commentaires du fichier expliquent plusieurs décisions et leur
motif — ils valent la lecture avant de défaire quoi que ce soit.

En préparant ce kit, le rendu de l'atelier dans un vrai navigateur a révélé un défaut
présent depuis le début : `textarea` ne figurait pas dans la règle de base des champs, et
tous les champs longs de la console s'affichaient **sur fond blanc**. C'est corrigé, et
les captures montrent l'état corrigé. Mentionné ici parce que c'est représentatif : ce qui
se voit à l'œil dans cette console n'est pas toujours ce que le code laisse supposer.

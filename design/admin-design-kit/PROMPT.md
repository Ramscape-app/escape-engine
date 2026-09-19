# Message à coller dans la session de design

Copier tout ce qui suit la ligne, et joindre le zip.

---

Je te confie la refonte visuelle de la console d'administration d'une plateforme
d'escape games sur mesure. Le zip joint contient tout le nécessaire.

**Commence par lire `LISEZMOI.md`** : il contient le brief complet, le contexte d'usage et
les contraintes. Puis ouvre `atelier.html` dans un navigateur — tout s'affiche, sans
serveur ni installation. C'est ta page de travail et ton seul moyen de voir le résultat :
l'application réelle demande une authentification, tu ne pourras pas la lancer.

## Le contexte en trois phrases

Un artisan fabrique des escape games personnalisés — mariages, anniversaires, départs à la
retraite. Cette console lui sert à tout : fiches clients, questionnaires envoyés aux
proches, écriture des énigmes, suivi de la soirée en direct, débrief. **Un seul
utilisateur, qui y passe des heures** : c'est la lisibilité sur la durée qui compte, pas
l'effet au premier coup d'œil.

Trois moments d'usage, très différents :

- **En préparation**, au bureau, plusieurs heures. Beaucoup de formulaires, beaucoup de
  lecture.
- **Pendant l'événement**, debout, sur un téléphone, dans une pièce sombre, pendant que
  des joueurs attendent. Il faut voir en un instant quelle équipe est bloquée.
- **Après**, pour montrer un débrief au client. Ça s'imprime.

## Ce que je te demande, par ordre de priorité

**1. Le mode clair et sombre.** C'est la demande principale. La console est aujourd'hui
sombre en dur : les 42 jetons de `:root` portent directement des valeurs sombres. Le
bouton ☀︎/☾ de l'atelier pose déjà `data-theme="light"` sur `<html>` et ne fait rien
d'autre — c'est le crochet à câbler. Il faut que le réglage système
(`prefers-color-scheme`) **et** le bouton manuel fonctionnent tous les deux. Le mode clair
doit rester utilisable le soir dans une pièce sombre : pas de blanc pur.

**2. Rendre l'ensemble plus professionnel.** Volontairement large. Les pistes qui me
semblent les plus payantes : la hiérarchie typographique (trois niveaux de titres qui ne
se lisent pas vraiment comme trois), la densité de la fiche client et ses 22 champs, les
états vides (`.state`, présent sur tous les écrans), et les tableaux — fonctionnels et
sans caractère.

**3. Les deux écrans difficiles.** `.modalbox.large`, le compositeur de questionnaire :
une liste défilante de 70 questions à cocher, chacune dépliant trois champs — le pire cas
de densité. Et `.livegrid`, le suivi en direct : c'est celui qu'on consulte debout, sur
téléphone, dans l'urgence. Si ces deux-là tiennent, le reste tiendra.

## La contrainte qui commande tout le reste

**Travaille uniquement sur `css/admin.css` et `atelier.html`. Ne touche pas à
`src/admin.html`.**

Ce n'est pas une précaution de principe. `src/admin.html` fait 2 700 lignes, et
l'essentiel de son HTML n'existe pas dans le fichier : il est produit à l'exécution par 40
fonctions JavaScript qui assemblent des chaînes de gabarit. Une classe renommée dans le
HTML statique laisse derrière elle des dizaines de gabarits qui émettent encore
l'ancienne, et la moitié de la console perd son style **sans qu'aucune erreur
n'apparaisse**. `src/GABARITS.md` donne le tableau : quelle fonction produit quelles
classes. `src/admin.html` est là pour comprendre la structure, pas pour être modifié.

Les autres contraintes, non négociables :

- **Aucune bibliothèque, aucun framework, aucune étape de build.** Pas de Tailwind, pas de
  React, pas de Sass ni de PostCSS. Du CSS écrit à la main, servi tel quel.
- **Aucun script externe ajouté** : la page porte la session d'authentification.
- **Polices système.** Une police Google Fonts est envisageable, mais demande-la
  explicitement au lieu de la supposer.
- **Tout doit tenir sur un téléphone.**
- **Les `.tpv-*` : n'y touche pas.** Elles reproduisent les écrans du jeu pour
  prévisualiser un thème, et doivent refléter exactement ce que fait le moteur, qui n'est
  pas dans le zip. Leur mise en page dans la grille est modifiable ; leur structure interne
  et leurs couleurs non — celles-ci viennent de variables injectées par le JavaScript.

## La démarche que j'attends

1. Lis `LISEZMOI.md`, puis `CONTRAT.md` (l'inventaire figé).
2. Ouvre `atelier.html` et regarde l'état actuel. Les captures dans `captures/` montrent
   le même rendu, au bureau et sur téléphone, si c'est plus commode.
3. Décide d'une direction **avant** de toucher au CSS, et dis-la-moi en trois lignes.
4. Travaille par passes : d'abord la structure des jetons et les deux modes, ensuite la
   typographie, ensuite les composants. Recharge l'atelier à chaque passe et **regarde
   vraiment le résultat** — c'est en rendant cette page qu'on a découvert que tous les
   champs longs de la console s'affichaient sur fond blanc, ce que la lecture du code ne
   laissait pas soupçonner.
5. Vérifie les deux modes et les deux largeurs avant de conclure.

## Ce que je veux récupérer

**Deux choses :**

1. **`css/admin.css` complet**, modes clair et sombre inclus. Le fichier entier, pas un
   diff ni des extraits : il sera repris tel quel comme base d'intégration.
2. **Une note courte** — une page suffit — sur les décisions prises et leur motif : la
   logique de la palette, ce qui a changé dans l'échelle typographique, ce que tu as
   envisagé puis écarté et pourquoi. C'est cette note qui permettra de reprendre ton
   travail plus tard sans le défaire par ignorance.

Si tu veux proposer une direction qui s'écarte de la structure actuelle, fais-le **en
plus**, dans un fichier séparé. Je la lirai ; elle ne remplace pas le point 1.

**Un seul impératif absolu** : les **noms** listés dans `CONTRAT.md` — 127 classes, 117
`id`, 42 jetons — doivent tous exister dans ce que tu me rends. Leurs **valeurs** sont
entièrement à toi, ajoute ce que tu veux, mais ne supprime ni ne renomme. Un `id` disparu
ne produit aucune erreur visible : la fonction JavaScript s'arrête et le bouton ne fait
plus rien. C'est le seul dégât qu'on ne voit pas venir, et je le vérifierai
mécaniquement au retour.

## Une dernière chose

La feuille a déjà été assainie une fois : elle comptait 24 tailles de police et 11 rayons
différents, chaque ajout inventant ses propres valeurs. Les 42 jetons sont le résultat de
ce ménage, et les commentaires du fichier expliquent plusieurs décisions et leur motif.
Ils valent la lecture avant de défaire quoi que ce soit — et si tu penses qu'une de ces
décisions est mauvaise, dis-le, c'est une information utile.

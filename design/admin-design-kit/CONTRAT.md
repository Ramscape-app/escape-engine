# Contrat d'intégration — console d'administration

> Généré par `scripts/inventaire-admin.mjs`. Ne pas éditer à la main.

La console est un fichier unique, `public/admin.html`, sans étape de build ni
framework. **L'essentiel de son HTML n'existe pas dans le fichier** : il est produit à
l'exécution par une quarantaine de gabarits JavaScript. Une classe renommée dans le HTML
statique laisse donc derrière elle des dizaines de gabarits qui émettent encore
l'ancienne.

## Ce qui peut changer librement

- **Les valeurs** des 42 jetons CSS ci-dessous.
- Les propriétés à l'intérieur de n'importe quelle règle.
- Les règles ajoutées, les états `:hover` / `:focus-visible`, les media queries.
- L'ajout de jetons.

## Ce qui ne doit pas disparaître

- **Les 127 noms de classes** listés plus bas.
- **Les 117 `id`** listés plus bas : le script les cherche par
  `getElementById`. Un `id` absent ne produit pas d'erreur visible — la fonction
  s'arrête, et **le bouton ne fait plus rien**.
- **Les 42 noms de jetons** : ils sont lus par le JavaScript pour l'aperçu
  de thème.

## Jetons (42)

```
--accent
--accent-ink
--accent-line
--accent-soft
--bg
--border
--border-hi
--danger
--danger-soft
--dim
--ease
--faint
--mono
--nav-w
--ok
--ok-soft
--r
--r-full
--r-lg
--r-sm
--ring
--s1
--s2
--s3
--s4
--s5
--s6
--s7
--sans
--surface
--surface-2
--surface-hi
--t-2xl
--t-lg
--t-md
--t-micro
--t-sm
--t-xl
--t-xs
--text
--warn
--warn-soft
```

## Classes (127)

```
actions
active
aidebox
ale
apercu
bar
brand
btn
burger
cards
clicard
clientgrid
colorgrid
colorrow
count
cpdetail
cphead
cplist
cpobl
cprow
cpsec
cptop
createbox
created
ctr
ctrbox
ctrhead
d
dbgrid
dbsec
dbstat
del
done
dot
eqbar
eqcard
err
field
filbox
fillist
filrow
formrow
genbtn
h
help
hint
inline
ko
kpi
kpis
l
large
lb
livegrid
login
main
mark
matsec
me
mediaitem
medialist
mediameta
meta
modalact
modalbox
msg
navbtn
navdot
navgroup
now
off
ok
on
open
p
page-head
pbgrp
pbs
pill
preset
presets
projetgrid
qnbloc
qnhead
row
scard
section
section-head
sel
shell
show
side
side-overlay
stat
state
sub
sub2
swatches
tablecard
tablescroll
themeedit
themeitem
themelist
themewrap
ti-ic
tile
tiles
tog
topbar
tpv
tpv-acte
tpv-amb
tpv-bar
tpv-card
tpv-cards
tpv-eyebrow
tpv-fb
tpv-hint
tpv-in
tpv-input
tpv-logo
tpv-narr
tpv-q
tpv-screen
txt
v
vd
```

## Identifiants (117)

```
aide-enig
aide-msg
app
app-msg
biblio-list
biblio-msg
blocages
bx-cat
bx-filtre
bx-id
bx-json
bx-tags
bx-titre
c-jeu
c-pseudo
c-pwd
c-result
cat-corps
cat-msg
cd-code
cd-jeu
cd-label
cd-max
cli-contact
cli-email
cli-fiche
cli-jeu-lier
cli-liste
cli-matiere
cli-msg
cli-nom
cli-note
cli-questionnaires
cli-statut
cli-tel
code-msg
codes-list
count
create-msg
db-choix
db-contenu
db-msg
email
engagement
jeux-list
kpis
list
live-detail
live-equipes
live-msg
login
login-btn
login-msg
mauvaises
me
modal-composer
nav-accueil
nav-biblio
nav-catalogue
nav-clients
nav-codes
nav-debrief
nav-jeux
nav-joueurs
nav-live
nav-live-dot
nav-stats
nav-themes
newjeu-msg
nj-name
nj-slug
overview
password
q-aide
q-ingredient
q-libelle
q-ordre
q-section
q-sections
q-type
qn-accueil
qn-compte
qn-nom
recap
side
side-overlay
t-ambiance
t-colors
t-contraste
t-font-body
t-font-display
t-font-mono
t-glow
t-id
t-name
t-presets
t-preview
t-radius
t-titre-casse
t-titre-espace
t-titre-poids
theme-edit
theme-msg
themes-list
themeusage
tiles
view-accueil
view-biblio
view-catalogue
view-clients
view-codes
view-debrief
view-jeux
view-joueurs
view-live
view-stats
view-themes
```

## Classes utilisées sans règle CSS (1)

Purement sémantiques, ou stylées par un sélecteur de descendance. À ne pas supprimer
pour autant.

```
pbs
```

# Refaire les captures du kit

Les captures de `admin-design-kit/captures/` sont le rendu de `atelier.html` dans un vrai
navigateur. Elles ne sont pas décoratives : c'est en les regardant qu'on a découvert que
tous les `textarea` de la console s'affichaient sur fond blanc, ce que la lecture du code
ne laissait pas soupçonner.

Elles se refont à part du reste du kit (`scripts/kit-design.sh`) parce qu'elles demandent
Chromium, qui n'est pas une dépendance du projet.

## Avec Chromium déjà présent

```bash
npm install --no-save playwright-core
node design/capturer.mjs
```

Le script cherche Chromium à l'emplacement de Playwright
(`/opt/pw-browsers/chromium-*/chrome-linux/chrome`). Ailleurs, passer le chemin :

```bash
CHROME=/usr/bin/chromium node design/capturer.mjs
```

## Sans Chromium

`npx playwright install chromium` l'installe, puis la commande ci-dessus.

## Ce qui est produit

| Fichier | Quoi |
|---|---|
| `atelier-bureau.png` | La page entière en 1440 px — le poste où la console sert vraiment |
| `atelier-mobile.png` | La page entière en 390 px — le téléphone, pendant l'événement |
| `detail-clients.png` | La fiche client, le plus long formulaire |
| `detail-compositeur.png` | Le compositeur de questionnaire, le pire cas de densité |
| `detail-suivi-direct.png` | Le suivi en direct, l'écran consulté debout |
| `detail-theme.png` | L'éditeur de thème et son aperçu fidèle |
| `detail-matiere.png` | La matière collectée, avec ses vignettes de médias |

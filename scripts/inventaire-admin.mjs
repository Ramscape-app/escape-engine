#!/usr/bin/env node
// Inventaire des classes et des ids de la console d'administration.
//
// Pourquoi un script et pas une liste tenue à la main : l'essentiel du HTML
// d'`admin.html` n'existe pas dans le fichier. Il est produit à l'exécution par
// une quarantaine de gabarits JS (`renderClients`, `blocQuestionnaire`,
// `carteIngredient`…), et une liste écrite à la main serait fausse dès le
// prochain écran ajouté.
//
// Deux usages :
//   node scripts/inventaire-admin.mjs             → affiche l'inventaire
//   node scripts/inventaire-admin.mjs --contrat   → écrit le CONTRAT.md du kit
//   node scripts/inventaire-admin.mjs --manquants → ce que l'atelier n'montre pas
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PAGE = 'public/admin.html';
const ATELIER = 'design/admin-design-kit/atelier.html';
const CSS = 'design/admin-design-kit/css/admin.css';

// Les classes posées par le navigateur ou par un `classList.toggle` dynamique :
// elles n'apparaissent pas comme littéral dans un attribut `class`.
const DYNAMIQUES = ['active', 'open', 'show', 'sel', 'on', 'rempli', 'inactive', 'disabled'];

const lire = (p) => readFileSync(p, 'utf8');

// Toutes les valeurs d'attribut `class`, y compris celles écrites dans un
// gabarit JS avec des trous `${…}` au milieu.
export function classes(src) {
  const trouvees = new Set();
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    for (const brut of m[1].split(/\s+/)) {
      // `${CLI_SEL===c.id?'sel':''}` et compagnie : on garde les littéraux
      // qu'on peut lire, on jette les expressions.
      if (!brut || brut.includes('$') || brut.includes('{')) continue;
      trouvees.add(brut);
    }
  }
  // Les classes ajoutées par le script après coup.
  for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\('([a-zA-Z0-9_-]+)'/g))
    trouvees.add(m[1]);
  // Celles qui ne vivent que dans une expression ternaire de gabarit.
  for (const m of src.matchAll(/\?\s*'([a-z][a-z0-9-]{1,20})'\s*:\s*''/g))
    if (DYNAMIQUES.includes(m[1])) trouvees.add(m[1]);
  return trouvees;
}

export function ids(src) {
  return new Set([
    ...[...src.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]),
    ...[...src.matchAll(/\.id\s*=\s*'([a-zA-Z0-9_-]+)'/g)].map(m => m[1]),
  ]);
}

// Les sélecteurs de classe réellement définis dans la feuille.
export function classesCSS(css) {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set([...sansCommentaires.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m => m[1]));
}

export function jetons(css) {
  return [...new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))].sort();
}

const src = lire(PAGE);
const cls = [...classes(src)].sort();
const identifiants = [...ids(src)].sort();
const css = existsSync(CSS) ? lire(CSS) : '';
const definies = classesCSS(css);
const tokens = jetons(css);

// Une classe utilisée sans règle CSS : soit un oubli, soit une classe purement
// sémantique. Le signaler évite de croire qu'un composant est stylé.
const sansStyle = cls.filter(c => !definies.has(c));

if (process.argv.includes('--manquants')) {
  if (!existsSync(ATELIER)) { console.error('Pas d\'atelier : ' + ATELIER); process.exit(1); }
  const atelier = lire(ATELIER);
  const montrees = classes(atelier);
  // Ce que l'échantillonnier n'affiche pas, le designer ne le verra pas.
  const absentes = cls.filter(c => !montrees.has(c) && definies.has(c));
  if (!absentes.length) { console.log('✓ L\'atelier montre toutes les classes stylees de l\'admin'); process.exit(0); }
  console.log(`${absentes.length} classe(s) stylee(s) absente(s) de l'atelier :\n`);
  console.log('  ' + absentes.join('\n  '));
  process.exit(0);
}

if (process.argv.includes('--contrat')) {
  const md = `# Contrat d'intégration — console d'administration

> Généré par \`scripts/inventaire-admin.mjs\`. Ne pas éditer à la main.

La console est un fichier unique, \`public/admin.html\`, sans étape de build ni
framework. **L'essentiel de son HTML n'existe pas dans le fichier** : il est produit à
l'exécution par une quarantaine de gabarits JavaScript. Une classe renommée dans le HTML
statique laisse donc derrière elle des dizaines de gabarits qui émettent encore
l'ancienne.

## Ce qui peut changer librement

- **Les valeurs** des ${tokens.length} jetons CSS ci-dessous.
- Les propriétés à l'intérieur de n'importe quelle règle.
- Les règles ajoutées, les états \`:hover\` / \`:focus-visible\`, les media queries.
- L'ajout de jetons.

## Ce qui ne doit pas disparaître

- **Les ${cls.length} noms de classes** listés plus bas.
- **Les ${identifiants.length} \`id\`** listés plus bas : le script les cherche par
  \`getElementById\`. Un \`id\` absent ne produit pas d'erreur visible — la fonction
  s'arrête, et **le bouton ne fait plus rien**.
- **Les ${tokens.length} noms de jetons** : ils sont lus par le JavaScript pour l'aperçu
  de thème.

## Jetons (${tokens.length})

\`\`\`
${tokens.join('\n')}
\`\`\`

## Classes (${cls.length})

\`\`\`
${cls.join('\n')}
\`\`\`

## Identifiants (${identifiants.length})

\`\`\`
${identifiants.join('\n')}
\`\`\`

## Classes utilisées sans règle CSS (${sansStyle.length})

Purement sémantiques, ou stylées par un sélecteur de descendance. À ne pas supprimer
pour autant.

\`\`\`
${sansStyle.join('\n') || '(aucune)'}
\`\`\`
`;
  writeFileSync('design/admin-design-kit/CONTRAT.md', md);
  console.log(`✓ CONTRAT.md ecrit — ${cls.length} classes, ${identifiants.length} ids, ${tokens.length} jetons`);
  process.exit(0);
}

console.log(`${cls.length} classes, ${identifiants.length} ids, ${tokens.length} jetons`);
console.log(`${sansStyle.length} classe(s) sans regle CSS : ${sansStyle.join(', ') || '(aucune)'}`);

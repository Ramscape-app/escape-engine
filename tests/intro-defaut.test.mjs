import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTRO_DEFAUT } from '../public/shared/intro-defaut.js';

// Ces textes etaient enfermes dans `public/index.html` : le moteur les
// appliquait, l'editeur affichait des champs vides, et l'organisateur editait
// a l'aveugle un texte qu'il ne voyait jamais. Ils sont maintenant partages —
// donc leur forme devient un contrat entre les deux pages.

const PAGES = {
  moteur: readFileSync('public/index.html', 'utf8'),
  editeur: readFileSync('public/editeur.html', 'utf8'),
};

test('les trois pages d introduction sont decrites', () => {
  assert.deepEqual(Object.keys(INTRO_DEFAUT).sort(), ['boot', 'intro', 'preboot']);
});

test('chaque cle que l editeur propose existe dans le defaut', () => {
  // L'editeur pose un marque-place par champ, en lisant `D.<page>.<cle>`.
  // Une cle renommee dans le module laisserait le marque-place vide sans
  // qu'aucune erreur ne se produise.
  const attendus = [...PAGES.editeur.matchAll(/\bD\.(preboot|boot|intro)\.([a-zA-Z]+)/g)]
    .map(m => [m[1], m[2]]);
  assert.ok(attendus.length >= 10, `l'editeur ne lit que ${attendus.length} defauts`);
  for (const [page, cle] of attendus)
    assert.notEqual(INTRO_DEFAUT[page][cle], undefined, `INTRO_DEFAUT.${page}.${cle} manque`);
});

test('les deux pages lisent la meme source', () => {
  for (const [nom, src] of Object.entries(PAGES)) {
    assert.match(src, /shared\/intro-defaut\.js/, `${nom} n'importe pas le module`);
    assert.match(src, /window\.INTRO_DEFAUT\s*=\s*INTRO_DEFAUT/, `${nom} ne l'expose pas`);
  }
});

test('le moteur ne garde plus de copie locale des textes', () => {
  // La duplication serait invisible : le moteur afficherait ses anciens textes
  // et l'editeur en proposerait d'autres.
  assert.doesNotMatch(PAGES.moteur, /const INTRO_DEFAULTS\s*=\s*\{/);
  assert.equal(PAGES.moteur.includes(INTRO_DEFAUT.preboot.warning), false,
    'un texte du module est encore ecrit en dur dans le moteur');
});

test('le moteur lit le module au moment de l usage, pas au chargement', () => {
  // Un script de type module est differe : lu dans un `const` de haut niveau,
  // `window.INTRO_DEFAUT` serait encore `undefined`.
  const fn = PAGES.moteur.match(/function getIntroConfig\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fn, 'getIntroConfig introuvable');
  assert.match(fn[0], /window\.INTRO_DEFAUT/);
});

test('le moteur degrade proprement si le module manque', () => {
  const fn = PAGES.moteur.match(/function getIntroConfig\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /console\.error/, 'aucune trace si le module ne charge pas');
});

test('le briefing porte le jeton {total}', () => {
  // Remplace par le nombre d'enigmes du jeu. Le perdre afficherait « {total} ».
  assert.match(INTRO_DEFAUT.intro.brief, /\{total\}/);
  assert.match(PAGES.moteur, /\{total\}/);
});

test('les consignes ont toutes leurs trois champs', () => {
  for (const c of INTRO_DEFAUT.preboot.consignes)
    assert.deepEqual(Object.keys(c).sort(), ['icon', 'texte', 'titre']);
});

test('aucun texte par defaut n est vide, sauf la musique', () => {
  // `music` vide est voulu : le moteur retombe alors sur sa piste par defaut.
  for (const [page, champs] of Object.entries(INTRO_DEFAUT))
    for (const [cle, val] of Object.entries(champs)) {
      if (cle === 'music') continue;
      const vide = Array.isArray(val) ? !val.length : !String(val).trim();
      assert.equal(vide, false, `INTRO_DEFAUT.${page}.${cle} est vide`);
    }
});

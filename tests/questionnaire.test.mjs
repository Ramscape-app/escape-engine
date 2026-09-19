import test from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerItems } from '../netlify/functions/questionnaire-save.js';

// `items` n'est pas qu'une preference d'affichage : c'est la liste blanche que
// `repondre-enregistrer` consulte pour decider si un porteur de lien a le droit
// d'ecrire sous un `question_id` donne. Ce qui entre ici doit donc etre propre.

test('garde une selection simple, dans l ordre donne', () => {
  const out = nettoyerItems([{ q: 'prenom' }, { q: 'annee_rencontre' }]);
  assert.deepEqual(out.map(i => i.q), ['prenom', 'annee_rencontre']);
});

test('rejette un identifiant qui n a pas la forme d un slug', () => {
  const out = nettoyerItems([
    { q: 'prenom' },
    { q: 'Prenom' },              // majuscules
    { q: 'pre-nom' },             // tiret
    { q: '../questions' },        // traversee
    { q: 'a b' },                 // espace
    { q: "x'; drop table" },
  ]);
  assert.deepEqual(out.map(i => i.q), ['prenom']);
});

test('ignore les entrees vides ou mal formees sans exploser', () => {
  const out = nettoyerItems([null, undefined, {}, { q: '' }, 'prenom', 42, { q: 'ok_slug' }]);
  assert.deepEqual(out.map(i => i.q), ['ok_slug']);
});

test('dedoublonne : une question ne peut pas etre posee deux fois', () => {
  const out = nettoyerItems([{ q: 'prenom' }, { q: 'prenom', libelle: 'Encore ?' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].libelle, undefined);
});

test('ne garde que les cles attendues', () => {
  // Via JSON.parse, comme les donnees arrivent reellement (req.json()) : c'est
  // le seul chemin par lequel `__proto__` devient une vraie cle propre.
  const brut = JSON.parse(`[{
    "q":"prenom", "libelle":"Ton prenom ?", "valeur":"Marie", "obligatoire":true,
    "role":"admin", "__proto__":{"pollue":true}
  }]`);
  const [item] = nettoyerItems(brut);
  // Une cle inattendue qui arriverait jusqu'en base finirait par etre relue
  // comme une consigne par le code qui lit `items`.
  assert.deepEqual(Object.keys(item).sort(), ['libelle', 'obligatoire', 'q', 'valeur']);
  assert.equal({}.pollue, undefined);
});

test('omet les champs facultatifs vides plutot que de stocker du vide', () => {
  const [item] = nettoyerItems([{ q: 'prenom', libelle: '  ', valeur: '', obligatoire: false }]);
  assert.deepEqual(item, { q: 'prenom' });
});

test('normalise obligatoire en booleen', () => {
  const [item] = nettoyerItems([{ q: 'prenom', obligatoire: 'oui' }]);
  assert.equal(item.obligatoire, true);
});

test('borne la longueur des textes personnalises', () => {
  const [item] = nettoyerItems([{ q: 'prenom', libelle: 'a'.repeat(900), valeur: 'b'.repeat(9000) }]);
  assert.equal(item.libelle.length, 400);
  assert.equal(item.valeur.length, 2000);
});

test('plafonne le nombre de questions', () => {
  const brut = Array.from({ length: 500 }, (_, i) => ({ q: 'q_' + i }));
  assert.equal(nettoyerItems(brut).length, 200);
});

test('un items qui n est pas un tableau donne une selection vide', () => {
  for (const mauvais of [null, undefined, 'prenom', 42, { q: 'prenom' }])
    assert.deepEqual(nettoyerItems(mauvais), []);
});

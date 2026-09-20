import test from 'node:test';
import assert from 'node:assert/strict';
import { aImporter } from '../netlify/functions/biblio-importer.js';

// Deux imports successifs ne doivent pas doubler la bibliotheque : le bouton
// invite a relancer, et rien n'empechait d'y cliquer deux fois.

const e = (title, extra = {}) => ({ titre: title, enigme: { title, format: 'text', ...extra } });

test('importe ce qui est nouveau', () => {
  const out = aImporter([e('Signal Localisé'), e('Le code du coffre')], []);
  assert.deepEqual(out.map(x => x.titre), ['Signal Localisé', 'Le code du coffre']);
});

test('ignore ce qui porte un titre deja present', () => {
  const out = aImporter([e('Signal Localisé'), e('Nouveau')], ['signal localisé']);
  assert.deepEqual(out.map(x => x.titre), ['Nouveau']);
});

test('la comparaison ignore la casse et les espaces de bord', () => {
  assert.equal(aImporter([e('  SIGNAL Localisé ')], ['Signal Localisé']).length, 0);
});

test('dedoublonne a l interieur du meme lot', () => {
  // Le modele porte deux fois « Signal Localisé » (enigmes 16 et 24).
  assert.equal(aImporter([e('Signal Localisé'), e('Signal Localisé')], []).length, 1);
});

test('l identifiant du jeu d origine ne suit pas', () => {
  const [out] = aImporter([{ titre: 'X', enigme: { id: 17, title: 'X', format: 'gps' } }], []);
  assert.equal(out.enigme.id, undefined);
  assert.equal(out.enigme.format, 'gps');
});

test('rejette ce qui n est pas une enigme', () => {
  assert.equal(aImporter([null, {}, { titre: 'X' }, { enigme: 'texte' }, 42], []).length, 0);
});

test('une enigme sans titre nulle part est ecartee', () => {
  // Sans titre, rien ne permet de la retrouver ni d'eviter le doublon.
  assert.equal(aImporter([{ enigme: { format: 'text' } }], []).length, 0);
});

test('reprend le titre de l enigme si aucun n est fourni', () => {
  const [out] = aImporter([{ enigme: { title: 'Du titre interne', format: 'text' } }], []);
  assert.equal(out.titre, 'Du titre interne');
});

test('borne les champs et normalise les tags', () => {
  const [out] = aImporter([{ titre: 'a'.repeat(400), categorie: 'b'.repeat(80),
    tags: Array(30).fill(7), enigme: { title: 'x' } }], []);
  assert.equal(out.titre.length, 200);
  assert.equal(out.categorie.length, 40);
  assert.equal(out.tags.length, 10);
  assert.equal(typeof out.tags[0], 'string');
});

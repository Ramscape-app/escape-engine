import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, propre, cheminAsset } from '../netlify/functions/asset-url.js';

// Cette fonction ouvre le bucket PUBLIC `assets` : tout ce qui y entre est
// lisible par quiconque devine l'URL. Le chemin est donc decide par le
// serveur, et c'est ce calcul qu'on couvre ici.

test('l extension vient du type declare, pas du nom de fichier', () => {
  const p = cheminAsset('mariage-dupont', 'piege.m4a.html', 'm4a', 1700000000);
  assert.match(p, /\.m4a$/);
  assert.ok(!p.includes('html'));
});

test('refuse la traversee de repertoire dans le dossier comme dans le nom', () => {
  // Les points et les barres obliques ne survivent pas : `propre` les remplace
  // puis rogne les tirets de tete et de queue.
  assert.equal(propre('../../secret'), 'secret');
  assert.equal(propre('a/b/c'), 'a-b-c');

  const p = cheminAsset(propre('../autre-jeu'), '../../../passwd', 'mp3', 1);
  assert.ok(!p.includes('..'), p);
  // Exactement deux segments : le dossier du jeu, puis le fichier.
  assert.equal(p.split('/').length, 2, p);
});

test('deux envois du meme fichier ne s ecrasent pas', () => {
  const a = cheminAsset('jeu', 'musique.m4a', 'm4a', 1700000000);
  const b = cheminAsset('jeu', 'musique.m4a', 'm4a', 1700000001);
  assert.notEqual(a, b);
});

test('le nom d origine reste reconnaissable', () => {
  // L'organisateur doit retrouver ses fichiers dans la console Supabase.
  const p = cheminAsset('mariage-dupont', 'Ma Musique (final).M4A', 'm4a', 1700000000);
  assert.equal(p, 'mariage-dupont/1700000000-ma-musique-final.m4a');
});

test('un nom entierement exotique ne produit pas un chemin vide', () => {
  const p = cheminAsset('jeu', '???.mp3', 'mp3', 1);
  assert.equal(p, 'jeu/1-fichier.mp3');
});

test('les accents sont retires, pas remplaces par du vide', () => {
  assert.equal(propre('Été à Nîmes'), 'ete-a-nimes');
});

test('le nom est borne', () => {
  const p = cheminAsset('jeu', 'a'.repeat(300) + '.mp3', 'mp3', 1);
  assert.equal(p.length, 'jeu/1-.mp3'.length + 60);
});

test('aucun format executable n est accepte', () => {
  // Un SVG est un document executable, servi ici depuis un domaine public.
  assert.equal(TYPES['image/svg+xml'], undefined);
  assert.equal(TYPES['text/html'], undefined);
  for (const t of Object.keys(TYPES)) assert.match(t, /^(image|audio)\//);
});

test('les sons courants passent', () => {
  for (const t of ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'])
    assert.ok(TYPES[t], t + ' devrait etre accepte');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { cheminMedia, cheminAutorise, entreeMedia, TYPES } from '../netlify/functions/_medias.js';

const COMPLICE = '3f2b7a10-1c4d-4e8f-9a21-6b5c4d3e2f10';
const AUTRE    = '00000000-1111-2222-3333-444444444444';

// Le chemin d'un media est decide par le serveur et par lui seul. C'est ce qui
// fait qu'un porteur de lien ne peut ni ecraser le fichier d'un autre, ni faire
// signer une URL sur un fichier qui n'est pas le sien.

test('l extension vient du type declare, jamais du nom de fichier', () => {
  const p = cheminMedia(COMPLICE, 'photo_voyage', 'image/jpeg');
  assert.match(p, /\.jpg$/);
  // Un « photo.jpg.html » ou un « ../../x.svg » n'a aucune prise : le nom
  // d'origine n'entre pas dans le chemin.
  assert.ok(!p.includes('html'));
});

test('un type hors liste blanche ne produit aucun chemin', () => {
  for (const type of ['image/svg+xml', 'text/html', 'application/pdf', 'video/mp4', '', undefined])
    assert.equal(cheminMedia(COMPLICE, 'q', type), null);
});

test('deux envois du meme fichier ne se marchent pas dessus', () => {
  const a = cheminMedia(COMPLICE, 'q', 'image/png');
  const b = cheminMedia(COMPLICE, 'q', 'image/png');
  assert.notEqual(a, b);
});

test('un chemin emis par le serveur est accepte pour son complice', () => {
  const p = cheminMedia(COMPLICE, 'annee_rencontre', 'image/webp');
  assert.equal(cheminAutorise(p, COMPLICE), true);
});

test('le chemin d un complice est refuse a un autre', () => {
  const p = cheminMedia(COMPLICE, 'q', 'image/jpeg');
  assert.equal(cheminAutorise(p, AUTRE), false);
});

test('refuse la traversee de repertoire et les chemins absolus', () => {
  const mauvais = [
    `${COMPLICE}/../${AUTRE}/aaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
    `/${COMPLICE}/q/aaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
    `${COMPLICE}/q/../../etc/passwd`,
    '../../../secret.jpg',
    `${COMPLICE}/q/aaaaaaaaaaaaaaaaaaaaaaaa.jpg/../x.jpg`,
  ];
  for (const p of mauvais) assert.equal(cheminAutorise(p, COMPLICE), false, p);
});

test('refuse un chemin qui n a pas la forme emise', () => {
  const mauvais = [
    `${COMPLICE}/q/pas-de-hexa.jpg`,          // fragment non aleatoire
    `${COMPLICE}/q/aaaa.jpg`,                 // trop court
    `${COMPLICE}/aaaaaaaaaaaaaaaaaaaaaaaa.jpg`, // question manquante
    `${COMPLICE}/q/AAAAAAAAAAAAAAAAAAAAAAAA.jpg`, // majuscules
    '', null, undefined,
  ];
  for (const p of mauvais) assert.equal(cheminAutorise(p, COMPLICE), false, String(p));
});

test('le nom d origine est borne et ne sert qu a l affichage', () => {
  const e = entreeMedia({ path: 'p', nom: 'x'.repeat(400), type: 'image/jpeg', taille: '12' });
  assert.equal(e.nom.length, 120);
  assert.equal(e.taille, 12);
  assert.deepEqual(Object.keys(e).sort(), ['ajoute_le', 'nom', 'path', 'taille', 'type']);
});

test('une taille non numerique ne devient pas NaN en base', () => {
  assert.equal(entreeMedia({ path: 'p', type: 'image/png', taille: 'beaucoup' }).taille, 0);
  assert.equal(entreeMedia({ path: 'p', type: 'image/png' }).taille, 0);
});

test('aucun format executable dans la liste blanche', () => {
  // Un SVG est un document executable : rien dans une photo de famille n'en a
  // besoin, et l'accepter ouvrirait une porte pour rien.
  for (const t of Object.keys(TYPES)) assert.match(t, /^(image|audio)\//);
  assert.equal(TYPES['image/svg+xml'], undefined);
});

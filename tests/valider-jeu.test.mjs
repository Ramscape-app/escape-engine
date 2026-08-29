// Regles de publication. Ce sont elles qui empechent un jeu injouable de partir
// devant des clients : chaque cas ici correspond a un incident possible en vrai.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerJeu, compte } from '../public/shared/valider-jeu.js';

const jeuValide = () => ({
  meta: { name: 'Mariage Dupont' },
  acts: [{ name: 'Acte I' }],
  actBoundaries: [0, 2],
  reglages: { dureeMinutes: 60 },
  enigmas: [
    { format: 'text', question: 'Q1', answer: ['reponse'], hint: 'indice 1' },
    { format: 'keypad', question: 'Q2', answer: ['1986'], hint: 'indice 2' },
  ],
});
const erreurs = (cfg) => validerJeu(cfg).filter(p => p.niveau === 'erreur');
const alertes = (cfg) => validerJeu(cfg).filter(p => p.niveau === 'alerte');

test('un jeu correct ne remonte rien', () => {
  assert.equal(validerJeu(jeuValide()).length, 0);
});

test('un jeu sans nom ni enigme est refuse deux fois', () => {
  assert.equal(erreurs({}).length, 2);
});

test('une enigme sans reponse est bloquante : le joueur resterait coince', () => {
  const c = jeuValide(); c.enigmas[0].answer = [];
  assert.equal(erreurs(c).length, 1);
});

test('une reponse faite d espaces ne compte pas comme une reponse', () => {
  const c = jeuValide(); c.enigmas[0].answer = ['   '];
  assert.equal(erreurs(c).length, 1);
});

test('un module qui valide dispense de reponse saisie', () => {
  const c = jeuValide();
  c.enigmas[0].answer = [];
  c.enigmas[0].iframe = 'module/cadenas.html?solution=1986&validate=1';
  assert.equal(erreurs(c).length, 0);
});

test('un module maison sans solution est bloquant', () => {
  const c = jeuValide();
  c.enigmas[0].iframe = 'module/cadenas.html?molettes=4&validate=1';
  assert.match(erreurs(c)[0].message, /cadenas.*solution/);
});

test('le clavier numerique refuse une reponse en lettres', () => {
  const c = jeuValide(); c.enigmas[1].answer = ['ABC'];
  assert.equal(erreurs(c).length, 1);
});

test('une enigme GPS sans coordonnees est bloquante', () => {
  const c = jeuValide();
  c.enigmas[0] = { format: 'gps', question: 'Ou ?', answer: ['x'], hint: 'i' };
  assert.equal(erreurs(c).length, 1);
});

test('les formats sans saisie ne reclament pas de reponse', () => {
  for (const format of ['puzzle', 'fakebug', 'nfc']) {
    const c = jeuValide();
    c.enigmas[0] = { format, question: 'Q', answer: [], hint: 'i' };
    assert.equal(erreurs(c).length, 0, format);
  }
});

test('une integration ni module ni URL est bloquante', () => {
  const c = jeuValide(); c.enigmas[0].iframe = 'cadenas.html';
  assert.equal(erreurs(c).length, 1);
});

test('une URL tierce reste acceptee', () => {
  const c = jeuValide(); c.enigmas[0].iframe = 'https://lockee.fr/o/AbCd';
  assert.equal(erreurs(c).length, 0);
});

test('le nombre de bornes doit suivre le nombre d actes', () => {
  const c = jeuValide(); c.acts = [{ name: 'A' }, { name: 'B' }];
  assert.match(erreurs(c)[0].message, /Decoupage incoherent/);
});

test('les bornes doivent couvrir toutes les enigmes', () => {
  const c = jeuValide(); c.actBoundaries = [0, 1];
  assert.match(erreurs(c)[0].message, /derniere borne/);
});

test('des bornes decroissantes sont bloquantes', () => {
  const c = jeuValide();
  c.acts = [{ name: 'A' }, { name: 'B' }];
  c.actBoundaries = [0, 2, 1];
  assert.ok(erreurs(c).some(e => /croissantes/.test(e.message)));
});

test('un acte vide est signale sans bloquer', () => {
  const c = jeuValide();
  c.acts = [{ name: 'A' }, { name: 'B' }];
  c.actBoundaries = [0, 2, 2];
  assert.equal(erreurs(c).length, 0);
  assert.ok(alertes(c).some(a => /aucune enigme/.test(a.message)));
});

test('une duree non numerique est bloquante, une duree vide ne l est pas', () => {
  const c = jeuValide(); c.reglages = { dureeMinutes: 'abc' };
  assert.equal(erreurs(c).length, 1);
  c.reglages = { dureeMinutes: '' };
  assert.equal(erreurs(c).length, 0);
});

test('l absence d indice alerte sans bloquer : une equipe bloquee n aura aucune aide', () => {
  const c = jeuValide(); delete c.enigmas[0].hint;
  assert.equal(erreurs(c).length, 0);
  assert.equal(alertes(c).length, 1);
});

test('compte separe erreurs et alertes', () => {
  const c = jeuValide();
  c.enigmas[0].answer = []; delete c.enigmas[1].hint;
  assert.deepEqual(compte(validerJeu(c)), { erreurs: 1, alertes: 1 });
});

test('chaque probleme d enigme porte son index, pour pointer la bonne', () => {
  const c = jeuValide(); c.enigmas[1].answer = [];
  assert.equal(erreurs(c)[0].enigme, 1);
});

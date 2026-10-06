// Le zoom de la carte pendant une enigme de geolocalisation.
//
// Le reglage « Zoom de la carte » de l'editeur semblait sans effet : on le
// changeait, la carte gardait le meme aspect. Deux causes cumulees.
//
//   1. Il n'etait lu qu'a la creation de la carte. Des le premier point GPS,
//      `distToZoom` reprenait la main et l'effacait.
//   2. `distToZoom` renvoyait entre 19 et 22, alors que le fond de carte est
//      declare `maxZoom: 19` dans shared/carte.js. Leaflet rabat la carte au
//      plafond de ses tuiles : toute la plage tombait sur 19. A 5 km comme a
//      40 m, le meme zoom.
//
// On evalue ici la vraie fonction, extraite du moteur, plutot qu'une copie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MOTEUR = readFileSync('public/index.html', 'utf8');
const CARTE = readFileSync('public/shared/carte.js', 'utf8');

// Le plafond reel des tuiles, lu la ou il est declare : si quelqu'un change de
// fournisseur, ce test suit sans qu'on y pense.
const PLAFOND = Number(/zoomMax:\s*(\d+)/.exec(CARTE)[1]);

function chargerDistToZoom() {
  const debut = MOTEUR.indexOf('function distToZoom(');
  assert.ok(debut > 0, 'distToZoom introuvable dans le moteur');
  let i = MOTEUR.indexOf('{', debut), n = 0, j = i;
  do { if (MOTEUR[j] === '{') n++; else if (MOTEUR[j] === '}') n--; j++; } while (n > 0);
  const constantes = (MOTEUR.match(/const ZOOM_TUILES_MAX = \d+;/) || [''])[0]
    + (MOTEUR.match(/const ZOOM_GPS_DEFAUT = \d+;/) || [''])[0]
    + (MOTEUR.match(/const SERRAGE_GPS = \d+;/) || [''])[0];
  return new Function(constantes + MOTEUR.slice(debut, j) + '; return distToZoom;')();
}
const distToZoom = chargerDistToZoom();

const DISTANCES = [10000, 5000, 2000, 800, 300, 100, 40];

test('le zoom ne depasse jamais ce que les tuiles savent afficher', () => {
  // C'etait tout le probleme : au-dessus du plafond, Leaflet rabat, et la
  // carte rend le meme resultat pour toutes les distances.
  for (const reglage of [null, 10, 13, 15, 17, 19]) {
    for (const d of DISTANCES) {
      const z = distToZoom(d, reglage);
      assert.ok(z <= PLAFOND,
        `reglage ${reglage}, ${d} m : zoom ${z.toFixed(2)} > plafond ${PLAFOND}`);
      assert.ok(z >= 1, `reglage ${reglage}, ${d} m : zoom ${z} invalide`);
    }
  }
});

test('on se resserre en approchant, jamais l inverse', () => {
  for (const reglage of [null, 12, 15, 17]) {
    const zooms = DISTANCES.map(d => distToZoom(d, reglage));
    for (let i = 1; i < zooms.length; i++) {
      assert.ok(zooms[i] >= zooms[i - 1] - 1e-9,
        `reglage ${reglage} : a ${DISTANCES[i]} m le zoom (${zooms[i].toFixed(2)}) `
        + `est plus large qu'a ${DISTANCES[i - 1]} m (${zooms[i - 1].toFixed(2)})`);
    }
    // Et la plage doit vraiment bouger, sinon « ca ne change rien » reste vrai.
    const amplitude = zooms[zooms.length - 1] - zooms[0];
    assert.ok(amplitude >= 2,
      `reglage ${reglage} : seulement ${amplitude.toFixed(2)} cran(s) entre le plus `
      + `loin et le plus pres — la carte parait figee`);
  }
});

test('le reglage de l organisateur gouverne la vue de loin', () => {
  // Le sens que l'editeur annonce : « vue de depart », donc la vue quand on
  // est encore loin. C'est ce que le joueur voit en ouvrant l'enigme.
  for (const reglage of [11, 13, 15, 17]) {
    assert.equal(distToZoom(10000, reglage), reglage,
      `a 10 km, le zoom devrait valoir le reglage ${reglage}`);
  }
  // Deux reglages differents doivent donner deux cartes differentes : c'est
  // exactement ce qui ne marchait pas.
  for (const d of DISTANCES) {
    assert.notEqual(distToZoom(d, 12), distToZoom(d, 17),
      `a ${d} m, les reglages 12 et 17 donnent le meme zoom`);
  }
});

test('un reglage absent ou absurde ne casse rien', () => {
  const defaut = Number(/const ZOOM_GPS_DEFAUT = (\d+);/.exec(MOTEUR)[1]);
  assert.equal(distToZoom(10000, null), defaut);
  assert.equal(distToZoom(10000, undefined), defaut);
  for (const absurde of [0, -4, 30, 99]) {
    const z = distToZoom(500, absurde);
    assert.ok(z >= 1 && z <= PLAFOND, `reglage ${absurde} : zoom ${z} hors bornes`);
  }
});

test('le suivi GPS passe bien le reglage a chaque recalage', () => {
  // Sans cet argument, la fonction retombe sur son defaut et le reglage de
  // l'organisateur est efface des le premier point GPS recu — le defaut
  // d'origine.
  assert.match(MOTEUR, /setView\(\[lat, lng\], distToZoom\(dist, e\.gpsZoom\)/);
  // La carte s'ouvre sur le meme defaut que la fonction, pas sur un 15 en dur.
  assert.match(MOTEUR, /zoom: \(e\.gpsZoom != null \? e\.gpsZoom : ZOOM_GPS_DEFAUT\)/);
});

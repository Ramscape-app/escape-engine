// Les trois mini-jeux ajoutes : differences, chronologie, taquin.
//
// Un module ne vaut que branche : un fichier que l'editeur n'enregistre pas
// est invisible pour l'organisateur, et un module qui ne signale pas sa
// reussite laisse le joueur devant une enigme qu'il vient pourtant de
// resoudre. Ces deux liens sont verifies ici pour TOUS les modules, pas
// seulement les nouveaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validerJeu, compte } from '../public/shared/valider-jeu.js';

const EDITEUR = readFileSync('public/editeur.html', 'utf8');
const FICHIERS = readdirSync('public/module').filter(f => f.endsWith('.html'));
const NOUVEAUX = ['differences', 'chronologie', 'taquin'];

// Les modules que l'editeur declare, avec leurs parametres.
function registre() {
  const bloc = /const MODULES = \[([\s\S]*?)\n\];/.exec(EDITEUR)[1];
  return [...bloc.matchAll(/\{\s*v:'([a-z0-9-]+)'/g)].map(m => m[1]);
}
const DECLARES = registre();

test('chaque fichier de module est propose dans l editeur', () => {
  // L'invariant general : un module sur le disque que personne ne peut
  // choisir ne sert a rien. C'est ce qui arriverait en ajoutant un fichier
  // sans toucher au tableau MODULES.
  for (const f of FICHIERS) {
    const nom = f.replace(/\.html$/, '');
    assert.ok(DECLARES.includes(nom),
      `public/module/${f} existe mais n'est pas dans MODULES : introuvable depuis l'editeur`);
  }
});

test('chaque module declare correspond a un fichier', () => {
  for (const nom of DECLARES) {
    assert.ok(FICHIERS.includes(nom + '.html'),
      `MODULES propose « ${nom} » mais public/module/${nom}.html n'existe pas`);
  }
});

test('les trois nouveaux signalent leur reussite sous leur propre nom', () => {
  for (const nom of NOUVEAUX) {
    const src = readFileSync(`public/module/${nom}.html`, 'utf8');
    const m = /postMessage\(\{\s*type:\s*'ramscape:solved',\s*module:\s*'([a-z-]+)'/.exec(src);
    assert.ok(m, `${nom} : aucun signal ramscape:solved`);
    assert.equal(m[1], nom, `${nom} : se declare sous le nom « ${m[1]} »`);
    // Et seulement si l'organisateur l'a demande.
    assert.match(src, /const VALIDATE = P\.get\('validate'\) === '1'/, nom);
  }
});

test('un parametre image est rendu par l editeur', () => {
  // Les modules n'avaient jamais eu d'image en parametre : le rendu generique
  // serait tombe sur un champ texte, et l'organisateur aurait du coller une
  // adresse a la main.
  const typesUtilises = new Set(
    [...EDITEUR.matchAll(/t:'([a-z]+)'/g)].map(m => m[1]));
  for (const t of typesUtilises) {
    if (t === 'text' || t === 'number') continue;      // le cas par defaut
    assert.match(EDITEUR, new RegExp(`p\\.t==='${t}'`),
      `le type de parametre « ${t} » est declare mais le rendu ne le traite pas`);
  }
  // L'adresse complete, pas le chemin de stockage : le moteur passe l'URL de
  // l'iframe telle quelle, un chemin nu se resoudrait depuis /module/.
  assert.match(EDITEUR, /onModuleParam\(i, cle, assetUrlEditor\(r\.path\)\)/);
});

test('le bouton de calibrage ouvre bien le mode calibrage', () => {
  // `moduleToUrl` ne recopie que les parametres declares dans MODULES : lui
  // passer `calibrer` dans les valeurs le faisait jeter en silence, et le
  // bouton ouvrait le module en mode jeu — sans relever aucune zone.
  assert.match(EDITEUR, /moduleToUrl\(nom, Object\.assign\(\{\}, vals, \{ validate:'' \}\)\) \+ '&calibrer=1'/);
  // Et le module sait le lire.
  assert.match(readFileSync('public/module/differences.html', 'utf8'),
    /const CALIBRER = P\.get\('calibrer'\) === '1'/);
});

test('publier un jeu des differences incomplet est refuse', () => {
  const base = (iframe) => ({ meta: { name: 'J' }, enigmas: [{ title: 'E', iframe }] });
  const sans = validerJeu(base('module/differences.html?a=http://x/a.png&validate=1'));
  const manquants = sans.filter(p => p.niveau === 'erreur').map(p => p.message).join(' | ');
  assert.match(manquants, /n'a pas de b/);
  assert.match(manquants, /n'a pas de zones/);

  const complet = validerJeu(base(
    'module/differences.html?a=http://x/a.png&b=http://x/b.png&zones=10,10,7&validate=1'));
  assert.equal(compte(complet).erreurs, 0, JSON.stringify(complet));
});

test('une remise en ordre a besoin d au moins deux elements', () => {
  const base = (iframe) => ({ meta: { name: 'J' }, enigmas: [{ title: 'E', iframe }] });
  assert.match(
    validerJeu(base('module/chronologie.html?validate=1')).map(p => p.message).join(' '),
    /n'a pas de items/);
  // Un seul element : l'ordre est deja bon, l'enigme se resout toute seule.
  const un = validerJeu(base('module/chronologie.html?items=Seul&validate=1'));
  assert.match(un.map(p => p.message).join(' '), /n'a qu'un element/);
  assert.equal(compte(un).erreurs, 1);

  const deux = validerJeu(base('module/chronologie.html?items=Un%0ADeux&validate=1'));
  assert.equal(compte(deux).erreurs, 0, JSON.stringify(deux));
});

// ── L'algorithme du taquin, evalue pour de vrai ──────────────────────────
//
// Une permutation tiree au hasard a une chance sur deux d'etre INSOLUBLE :
// le joueur chercherait sans fin une configuration qui n'existe pas. On
// verifie donc la propriete mathematique, pas le fait qu'il y ait du code.
function chargerTaquin(N) {
  const src = readFileSync('public/module/taquin.html', 'utf8');
  const debut = src.indexOf('const lig =');
  const fin = src.indexOf('function rendre');
  assert.ok(debut > 0 && fin > debut, 'bloc de logique du taquin introuvable');
  const corps = src.slice(debut, fin);
  return new Function('N', 'CASES', `
    let grille = [];
    ${corps}
    return { melanger, resolu, lire: () => grille };
  `)(N, N * N);
}

// Regle classique : largeur impaire -> inversions paires ; largeur paire ->
// (inversions + rangee du trou comptee depuis le bas) impair.
function soluble(g, N) {
  const vide = g.indexOf(N * N - 1);
  const t = g.filter(v => v !== N * N - 1);
  let inv = 0;
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) inv++;
  if (N % 2 === 1) return inv % 2 === 0;
  const rangeeDepuisLeBas = N - Math.floor(vide / N);
  return (inv + rangeeDepuisLeBas) % 2 === 1;
}

test('le taquin ne propose jamais une grille insoluble', () => {
  for (const N of [3, 4, 5]) {
    const t = chargerTaquin(N);
    for (let essai = 0; essai < 150; essai++) {
      t.melanger();
      const g = t.lire();
      assert.equal(g.length, N * N);
      assert.equal(new Set(g).size, N * N, `N=${N} : des tuiles en double`);
      assert.ok(soluble(g, N), `N=${N} : grille insoluble ${g.join(',')}`);
      assert.ok(!t.resolu(), `N=${N} : grille deja resolue au depart`);
    }
  }
});

// ── Le reperage des zones du jeu des differences ─────────────────────────
function chargerLireZones() {
  const src = readFileSync('public/module/differences.html', 'utf8');
  const debut = src.indexOf('function lireZones');
  let i = src.indexOf('{', debut), n = 0, j = i;
  do { if (src[j] === '{') n++; else if (src[j] === '}') n--; j++; } while (n > 0);
  return new Function(src.slice(debut, j) + '; return lireZones;')();
}

test('les zones se lisent en pourcentage, avec un rayon par defaut', () => {
  const lireZones = chargerLireZones();
  assert.deepEqual(lireZones('20,25,7;70,20,6'),
    [{ x: 20, y: 25, r: 7 }, { x: 70, y: 20, r: 6 }]);
  // Rayon absent ou absurde : une valeur utilisable plutot qu'une zone morte
  // sur laquelle le joueur cliquerait sans jamais rien declencher.
  assert.deepEqual(lireZones('50,50'), [{ x: 50, y: 50, r: 7 }]);
  assert.deepEqual(lireZones('50,50,0'), [{ x: 50, y: 50, r: 7 }]);
  // Entrees invalides ignorees, sans faire tomber le module.
  assert.deepEqual(lireZones(''), []);
  assert.deepEqual(lireZones('bof;10,20,3'), [{ x: 10, y: 20, r: 3 }]);
});

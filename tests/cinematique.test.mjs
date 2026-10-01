import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPERES, DELAI_PASSER, CADRES, TRANCHES, PETALES,
  planSequence, doitJouer, cleMemoire, decouperNom, nombreDeLettres, dureeTotale,
} from '../public/shared/cinematique.js';

const SOURCE = readFileSync('public/shared/cinematique.js', 'utf8');
const MOTEUR = readFileSync('public/index.html', 'utf8');

// ── Quand la sequence se joue, et quand elle se tait ──────────────────
// C'est la partie dont une erreur se paie cher : une ouverture de treize
// secondes imposee a chaque rechargement, ou au contraire jamais vue.

test('la sequence se joue a la premiere ouverture', () => {
  assert.equal(doitJouer({}), 'complete');
});

test('elle ne se rejoue pas sur un appareil qui l a deja vue', () => {
  assert.equal(doitJouer({ vue: true }), 'non');
});

test('un organisateur peut la rejouer avec ?cine=1, meme deja vue', () => {
  assert.equal(doitJouer({ vue: true, recherche: '?cine=1' }), 'complete');
  // Et meme si le jeu l'a desactivee : c'est ainsi qu'on la lui montre.
  assert.equal(doitJouer({ actif: false, recherche: '?cine=1' }), 'complete');
});

test('?cine=0 la coupe', () => {
  assert.equal(doitJouer({ recherche: '?cine=0' }), 'non');
});

test('le slug du jeu ne perturbe pas la lecture du parametre', () => {
  assert.equal(doitJouer({ recherche: '?slug=mariage-dupont&cine=1', vue: true }), 'complete');
  assert.equal(doitJouer({ recherche: '?slug=mariage-dupont' }), 'complete');
});

test('un jeu peut la desactiver', () => {
  assert.equal(doitJouer({ actif: false }), 'non');
});

test('qui a demande moins d animations recoit une version sobre, pas rien', () => {
  // Couper net priverait du nom du jeu ; treize secondes de mouvement
  // seraient une agression. D'ou un troisieme etat.
  assert.equal(doitJouer({ mouvementReduit: true }), 'sobre');
  // Mais « deja vue » reste prioritaire : pas d'ouverture du tout.
  assert.equal(doitJouer({ mouvementReduit: true, vue: true }), 'non');
});

test('la memoire est propre a chaque jeu', () => {
  assert.notEqual(cleMemoire('mariage-dupont'), cleMemoire('projet-1986'));
  assert.match(cleMemoire(''), /defaut/);
});

// ── L horloge ─────────────────────────────────────────────────────────

test('les actes sont poses dans l ordre', () => {
  const actes = {};
  for (const nom of Object.keys(REPERES)) actes[nom] = () => {};
  const plan = planSequence(actes);
  assert.equal(plan.length, Object.keys(REPERES).length);
  for (let i = 1; i < plan.length; i++)
    assert.ok(plan[i].t >= plan[i - 1].t, `${plan[i].nom} arrive avant ${plan[i - 1].nom}`);
});

test('un acte sans action n est pas programme', () => {
  // Sinon un `setTimeout` appellerait `undefined` et la sequence s arreterait
  // au milieu, sans rien dire.
  const plan = planSequence({ tunnel: () => {}, nom: () => {} });
  assert.deepEqual(plan.map(r => r.nom), ['tunnel', 'nom']);
});

test('chaque acte a la place qu il doit avoir', () => {
  // Le reassemblage apres l eclatement, les mots pendant le motif, le nom
  // apres l implosion : l inverse n aurait aucun sens a l ecran.
  assert.ok(REPERES.eclatement > REPERES.tunnel);
  assert.ok(REPERES.reassemblage > REPERES.eclatement);
  assert.ok(REPERES.mot1 > REPERES.motif);
  assert.ok(REPERES.mot3 > REPERES.mot2 && REPERES.mot2 > REPERES.mot1);
  assert.ok(REPERES.flash > REPERES.implosion);
  assert.ok(REPERES.nom > REPERES.flash);
  assert.ok(REPERES.fin >= REPERES.sortie);
});

test('l objet a le temps de se montrer ouvert avant de se refermer', () => {
  // Moins d une seconde et la vue eclatee ne se lit pas : on verrait un
  // tremblement, pas une decomposition.
  assert.ok(REPERES.reassemblage - REPERES.eclatement >= 1000);
});

test('le bouton passer arrive apres le debut, mais pas trop tard', () => {
  // Propose a la premiere seconde, il invite a ne pas regarder.
  assert.ok(DELAI_PASSER >= 1500);
  assert.ok(DELAI_PASSER < dureeTotale() / 2);
});

test('la sequence reste courte', () => {
  // Un effet d ouverture, pas un generique.
  assert.ok(dureeTotale() <= 15000, `${dureeTotale()} ms, c est trop long`);
});

// ── Le nom compose lettre a lettre ────────────────────────────────────

test('le nom se compose lettre a lettre, mot par mot', () => {
  // Groupe par mot : sans ce regroupement, une fin de ligne tomberait au
  // milieu d un mot, puisque chaque lettre est un bloc en ligne.
  assert.deepEqual(decouperNom('PROJET 1986'),
    [['P', 'R', 'O', 'J', 'E', 'T'], ['1', '9', '8', '6']]);
  assert.equal(nombreDeLettres('PROJET 1986'), 10);
});

test('les accents restent une seule lettre', () => {
  // Un decoupage naif sur les unites de code couperait un caractere compose.
  assert.deepEqual(decouperNom('ÉTÉ'), [['É', 'T', 'É']]);
});

test('les espaces en trop ne font pas de mots vides', () => {
  assert.deepEqual(decouperNom('  LES   NOCES '), [['L','E','S'], ['N','O','C','E','S']]);
});

test('un nom vide ne casse rien', () => {
  assert.deepEqual(decouperNom(''), []);
  assert.deepEqual(decouperNom(null), []);
  assert.equal(nombreDeLettres(''), 0);
});

test('la cascade des lettres finit avant la signature', () => {
  // Vingt-cinq lettres a 45 ms font plus d une seconde : si la signature
  // arrivait avant, le nom serait encore en train de s ecrire sous elle.
  const nomLong = 'LE MYSTERE DE LA VILLA BLANCHE';
  assert.ok(REPERES.nom + nombreDeLettres(nomLong) * 45 <= REPERES.signature + 200,
    'la composition du nom deborde sur la signature');
});

// ── Ce qui fait tenir l animation sur un telephone ────────────────────

// Isole le corps de chaque `@keyframes` en comptant les accolades : une
// expression reguliere s'arrete au mauvais endroit des qu'une animation tient
// sur une seule ligne, et le test passe alors sur le voisin.
function blocsKeyframes(src) {
  const blocs = [];
  const re = /@keyframes[^{]*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const debut = i;
    let prof = 1;
    while (i < src.length && prof > 0) {
      if (src[i] === '{') prof++;
      else if (src[i] === '}') prof--;
      i++;
    }
    blocs.push(src.slice(debut, i - 1));
    re.lastIndex = i;
  }
  return blocs;
}

test('on n anime que ce qui ne fait pas recalculer la mise en page', () => {
  // Animer une largeur, une hauteur, un `top` ou un `left` force le
  // navigateur a refaire sa mise en page a chaque image : c est exactement ce
  // qui fait saccader un telephone. Seuls `transform`, `opacity` et `filter`
  // sont pris en charge par le compositeur.
  const blocs = blocsKeyframes(SOURCE);
  assert.ok(blocs.length >= 6, `seulement ${blocs.length} animations trouvees`);
  const interdites = /(^|[;{\s])(width|height|top|left|right|bottom|margin|padding|inset)\s*:/;
  for (const b of blocs)
    assert.doesNotMatch(b, interdites, `une animation touche a la mise en page :\n${b}`);
});

test('le nombre de calques reste raisonnable', () => {
  // Chaque couche est un calque composite sur le GPU. Un telephone d entree
  // de gamme decroche bien avant la centaine.
  assert.ok(CADRES + TRANCHES + PETALES <= 48,
    `${CADRES + TRANCHES + PETALES} calques animes, c est trop`);
});

test('le module ne touche pas au document a l import', async () => {
  // Il est charge dans l en-tete de la page, donc avant que le corps existe.
  // Node n a pas de `document` : si le module en manipulait un au chargement,
  // cet import jetterait.
  assert.equal(typeof globalThis.document, 'undefined');
  const frais = await import('../public/shared/cinematique.js?frais=1');
  assert.equal(typeof frais.jouer, 'function');
});

test('le moteur attend la fin de la sequence avant le briefing', () => {
  // Sans `await`, le briefing s afficherait derriere le rideau et le joueur
  // le trouverait deja passe.
  assert.match(MOTEUR, /await lancerCinematique\(\)/);
});

test('le moteur dit pourquoi si le module manque', () => {
  const fn = MOTEUR.match(/async function lancerCinematique\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fn, 'lancerCinematique introuvable');
  assert.match(fn[0], /console\.error/);
  // Et il laisse passer : une sequence absente ne doit pas bloquer le jeu.
  assert.match(fn[0], /return;/);
});

test('le moteur retient la sequence comme vue', () => {
  const fn = MOTEUR.match(/async function lancerCinematique\(\)\s*\{[\s\S]*?\n\}/)[0];
  assert.match(fn, /localStorage\.setItem/);
  // Dans un `try` : en navigation privee, `localStorage` jette.
  assert.match(fn, /try \{ localStorage\.setItem/);
});

test('aucun accent grave dans la feuille de style', () => {
  // La feuille vit dans un litteral de gabarit. Un accent grave ecrit dans un
  // commentaire CSS — pour citer une propriete, par exemple — le referme, et
  // le reste du fichier devient du JavaScript invalide. L'erreur est obscure
  // (« Unexpected identifier ») et pointe soixante lignes plus haut.
  const style = SOURCE.match(/s\.textContent = `([\s\S]*?)\n`;/);
  assert.ok(style, 'bloc de style introuvable');
  assert.doesNotMatch(style[1], /`/);
});

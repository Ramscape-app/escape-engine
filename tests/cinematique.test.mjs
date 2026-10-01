import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPERES, DELAI_PASSER, FACES, dispersion, composer,
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
  const plan = planSequence({ assemblage: () => {}, nom: () => {} });
  assert.deepEqual(plan.map(r => r.nom), ['assemblage', 'nom']);
});

test('un acte inconnu est ignore', () => {
  // Un nom d acte mal orthographie ne doit pas creer un rendez-vous fantome
  // a l instant zero.
  const plan = planSequence({ tunnel: () => {}, nom: () => {} });
  assert.deepEqual(plan.map(r => r.nom), ['nom']);
});

test('chaque acte a la place qu il doit avoir', () => {
  // La boite se scelle avant de s ouvrir, se referme avant de s effondrer, et
  // la marque arrive apres le souffle : l inverse n aurait aucun sens.
  assert.ok(REPERES.scellee > REPERES.assemblage);
  assert.ok(REPERES.ouverture > REPERES.scellee);
  assert.ok(REPERES.mot1 > REPERES.ouverture);
  assert.ok(REPERES.mot3 > REPERES.mot2 && REPERES.mot2 > REPERES.mot1);
  assert.ok(REPERES.fermeture > REPERES.mot3);
  assert.ok(REPERES.implosion > REPERES.fermeture);
  assert.ok(REPERES.flash > REPERES.implosion);
  assert.ok(REPERES.nom > REPERES.flash);
  assert.ok(REPERES.fin >= REPERES.sortie);
});

test('les faces ont le temps d arriver avant que la boite ne s ouvre', () => {
  // Leur convergence dure 1,9 s. S ouvrir avant la fin donnerait une boite qui
  // se defait sans s etre jamais fermee.
  assert.ok(REPERES.ouverture - REPERES.assemblage >= 1900);
});

test('la boite reste ouverte pendant les trois mots', () => {
  assert.ok(REPERES.fermeture > REPERES.mot3 + 1000,
    'elle se referme avant que le dernier mot ait fini de passer');
});

test('la boite a le temps de se montrer ouverte', () => {
  // Moins d une seconde et l ouverture ne se lit pas : on verrait un
  // tremblement, pas une boite qui s ouvre.
  assert.ok(REPERES.fermeture - REPERES.ouverture >= 1000);
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

test('la boite a ses six faces', () => {
  assert.deepEqual([...FACES].sort(),
    ['arriere', 'avant', 'bas', 'droite', 'gauche', 'haut']);
});

test('chaque face a sa place sur le cube', () => {
  // Une face oubliee laisserait un trou par lequel on verrait l interieur
  // depuis l exterieur.
  for (const f of FACES)
    assert.match(SOURCE, new RegExp(`\\.cine-boite\\.scellee \\.cine-face\\.${f}\\b`),
      `la face ${f} n a pas de position fermee`);
});

test('les quatre cotes basculent sur leur arete basse', () => {
  // Sans point de pivot sur le bas, ils tourneraient autour de leur centre et
  // traverseraient la boite au lieu de s ouvrir.
  assert.match(SOURCE, /\.cine-face\.avant, \.cine-face\.arriere,[\s\S]{0,120}transform-origin: 50% 100%/);
  for (const f of ['avant', 'arriere', 'droite', 'gauche'])
    assert.match(SOURCE, new RegExp(`\\.ouverte \\.cine-face\\.${f}[^;]*rotateX\\(104deg\\)`),
      `le cote ${f} ne s ouvre pas`);
});

// ── Le bloc est fait de matiere, pas de traits ────────────────────────

test('les faces sont des surfaces pleines', () => {
  // La demande etait explicite : moins de dessin au trait, des objets
  // consistants. Un contour de 1 px sur fond transparent ne lit pas comme un
  // volume.
  const i = SOURCE.indexOf('.cine-face {');
  const corps = SOURCE.slice(i, SOURCE.indexOf('}', i));
  assert.match(corps, /background:\s*\n?\s*linear-gradient/,
    'la face n a pas de remplissage');
  assert.doesNotMatch(corps, /(^|[;\s])border:\s*\d/,
    'la face est encore dessinee au trait');
});

test('les faces n ont pas toutes la meme clarte', () => {
  // Un cube dont les six faces seraient jumelles n aurait aucun volume : ce
  // sont les ecarts de lumiere qui disent ou est le haut.
  assert.match(SOURCE, /filter:\s*brightness\(var\(--lum\)\)/);
  const clartes = SOURCE.match(/\{ haut: [\d.]+, avant: [\d.]+, droite: [\d.]+, gauche: [\d.]+, arriere: [\d.]+, bas: [\d.]+ \}/);
  assert.ok(clartes, 'aucune table de clarte par face');
  const vals = clartes[0].match(/[\d.]+/g).map(Number);
  assert.equal(new Set(vals).size, 6, 'deux faces ont la meme clarte');
  assert.ok(vals[0] > vals[5], 'le haut n est pas plus clair que le bas');
});

test('l ombre du texte ne reste pas pendant l animation', () => {
  // Le voile sombre sous les mots etait affiche en permanence : il posait une
  // tache immobile au milieu de l image pendant toute la sequence.
  const i = SOURCE.indexOf('.cine-texte::before {');
  const corps = SOURCE.slice(i, SOURCE.indexOf('}', i));
  assert.match(corps, /opacity:\s*0/, 'le voile est visible par defaut');
  assert.match(SOURCE, /\.cine\.avec-texte \.cine-texte::before \{ opacity: 1; \}/);
});

test('la sequence ne montre plus la photo du jeu', () => {
  // Elle signe la marque, pas le jeu.
  assert.doesNotMatch(SOURCE, /background-image/);
  assert.doesNotMatch(MOTEUR, /photo:\s*b\.avatar/);
});

test('le moteur revele la marque et non le nom du jeu', () => {
  const fn = MOTEUR.match(/async function lancerCinematique\(\)[\s\S]*?\n\}/)[0];
  assert.match(fn, /cine\.marque/);
  assert.doesNotMatch(fn, /GAME_NAME/);
});

// ── La dispersion de depart ───────────────────────────────────────────

test('les six faces partent de six endroits differents', () => {
  const vus = new Set();
  for (let i = 0; i < FACES.length; i++) {
    const d = dispersion(i, FACES.length);
    vus.add(`${d.x},${d.y},${d.z}`);
  }
  assert.equal(vus.size, FACES.length, 'deux faces partent du meme point');
});

test('la dispersion ne change pas d une lecture a l autre', () => {
  // Une sequence qui varie a chaque ouverture ne se regle pas : on ne saurait
  // jamais si une retouche a servi a quelque chose.
  assert.deepEqual(dispersion(3, FACES.length), dispersion(3, FACES.length));
});

test('les faces viennent toutes de l arriere-plan', () => {
  // Une face qui partirait devant la camera traverserait l ecran au lieu d y
  // entrer.
  for (let i = 0; i < FACES.length; i++)
    assert.ok(dispersion(i, FACES.length).z < -500, `la face ${i} part trop pres`);
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

// ── La musique ────────────────────────────────────────────────────────
// Generique et non celle du jeu. Programmee d'un bloc sur l'horloge audio :
// un `setTimeout` aurait derive des qu'un telephone ralentit.

// Un contexte audio de papier, qui note ce qu'on lui demande.
function fauxContexte() {
  const journal = { oscillateurs: [], demarrages: [], arrets: [], rampes: [] };
  const parametre = (nom) => ({
    value: 0,
    setValueAtTime(v, t) { journal.rampes.push([nom, 'pose', v, t]); return this; },
    linearRampToValueAtTime(v, t) { journal.rampes.push([nom, 'lineaire', v, t]); return this; },
    exponentialRampToValueAtTime(v, t) { journal.rampes.push([nom, 'expo', v, t]); return this; },
    cancelScheduledValues() { return this; },
  });
  const noeud = () => ({ connect() {}, disconnect() {} });
  const ctx = {
    currentTime: 100,
    destination: noeud(),
    createGain: () => ({ ...noeud(), gain: parametre('gain') }),
    createBiquadFilter: () => ({ ...noeud(), type: '', Q: { value: 0 }, frequency: parametre('filtre') }),
    createOscillator: () => {
      const o = {
        ...noeud(), type: '', frequency: parametre('freq'),
        start(t) { journal.demarrages.push(t); },
        stop(t) { journal.arrets.push(t); },
      };
      journal.oscillateurs.push(o);
      return o;
    },
    close() { journal.ferme = true; },
  };
  return { ctx, journal };
}

test('la musique est programmee a l avance, pas jouee au fil de l eau', () => {
  const { ctx, journal } = fauxContexte();
  composer(ctx, ctx.currentTime);
  // Tout est pose d'un coup : les oscillateurs des douze secondes existent
  // deja a la premiere milliseconde.
  assert.ok(journal.oscillateurs.length >= 15,
    `seulement ${journal.oscillateurs.length} sons programmes`);
  // Et chacun est cale sur un instant futur precis.
  assert.ok(journal.demarrages.every(t => t >= ctx.currentTime));
  assert.ok(Math.max(...journal.demarrages) > ctx.currentTime + 9,
    'rien n est programme pour la fin de la sequence');
});

test('chaque son s arrete apres avoir commence', () => {
  // Un oscillateur qu on oublie d arreter tient jusqu a la fermeture de la
  // page : un bourdonnement sous le jeu entier.
  const { ctx, journal } = fauxContexte();
  composer(ctx, ctx.currentTime);
  assert.equal(journal.arrets.length, journal.demarrages.length,
    'un son demarre sans jamais s arreter');
});

test('la musique se cale sur les actes de l image', () => {
  // Les impacts sont ecrits a partir de REPERES : ils ne peuvent pas se
  // desynchroniser d un acte qu on deplacerait.
  const { ctx, journal } = fauxContexte();
  const t0 = ctx.currentTime;
  composer(ctx, t0);
  for (const acte of ['scellee', 'ouverture', 'mot1', 'fermeture', 'nom'])
    assert.ok(journal.demarrages.some(t => Math.abs(t - (t0 + REPERES[acte] / 1000)) < 0.25),
      `aucun son a l acte « ${acte} »`);
});

test('passer la sequence coupe la musique', () => {
  const { ctx, journal } = fauxContexte();
  const m = composer(ctx, ctx.currentTime);
  const avant = journal.arrets.length;
  m.couper();
  assert.ok(journal.arrets.length > avant, 'la nappe continue apres la coupure');
  assert.ok(journal.rampes.some(([, forme, v]) => forme === 'expo' && v <= 0.001),
    'le volume ne redescend pas');
});

test('le moteur ne lance plus la musique du jeu avec la sequence', () => {
  // Elle doit demarrer sur le bouton du briefing, comme avant, et non se
  // superposer a la musique generique de la signature.
  const fn = MOTEUR.match(/async function lancerCinematique\(\)[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(fn, /intro-music/);
  assert.doesNotMatch(fn, /\bton:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Deux defauts de mise en page vus sur un telephone de 360 px, invisibles a
// 390 px — la largeur sur laquelle les essais precedents avaient ete faits.
// D'ou ces controles : ils tiennent sur la source, donc ils valent a toutes
// les largeurs d'un coup.

const MOTEUR = readFileSync('public/index.html', 'utf8');

// Isole le corps d'une regle CSS en comptant les accolades, PUIS retire les
// commentaires. Sans ce retrait, un commentaire qui cite la propriete qu'il
// explique — « `min-width: 0` : sans lui, … » — satisfait le controle, et le
// test passe sur le code casse. C'est exactement ce qui s'est produit ici au
// premier essai.
function regle(selecteur) {
  const i = MOTEUR.indexOf('\n' + selecteur + ' {');
  assert.notEqual(i, -1, `regle « ${selecteur} » introuvable`);
  const debut = MOTEUR.indexOf('{', i) + 1;
  let j = debut, prof = 1;
  while (j < MOTEUR.length && prof > 0) {
    if (MOTEUR[j] === '{') prof++;
    else if (MOTEUR[j] === '}') prof--;
    j++;
  }
  return MOTEUR.slice(debut, j - 1).replace(/\/\*[\s\S]*?\*\//g, '');
}

test('le champ de reponse peut retrecir', () => {
  // Un champ de saisie garde par defaut sa largeur naturelle — vingt
  // caracteres — et `flex: 1` ne suffit pas a l'en faire demordre : il faut
  // `min-width: 0`. Sans lui, la rangee « champ + VALIDER » faisait 351 px
  // pour 320 px disponibles sur un telephone de 360 px. Le debordement rendait
  // la colonne defilable lateralement, et le focus sur le champ emportait
  // l'enonce hors de l'ecran par la gauche.
  const r = regle('.answer-input');
  assert.match(r, /flex:\s*1/);
  assert.match(r, /min-width:\s*0/);
});

test('le bouton valider ne retrecit pas', () => {
  const r = regle('.submit-btn');
  assert.match(r, /flex:\s*none/);
  assert.match(r, /white-space:\s*nowrap/);
});

test('rien ne peut faire glisser l enonce lateralement', () => {
  // `overflow-y: auto` rend aussi l'axe horizontal defilable des qu'un enfant
  // depasse. Le fermer explicitement evite qu'un futur contenu trop large
  // reintroduise le meme defaut sans qu'on s'en apercoive.
  assert.match(regle('.enigma-body'), /overflow-x:\s*hidden/);
});

test('un contenu sans espaces ne peut pas elargir la colonne', () => {
  // Un code, une URL, une suite de chiffres : « selon le contenu », disait le
  // rapport. Sans coupure forcee, un seul mot long repousse toute la colonne.
  for (const sel of ['.enigma-question', '.enigma-narrative'])
    assert.match(regle(sel), /overflow-wrap:\s*anywhere/, `${sel} ne coupe pas les mots longs`);
});

test('les ecrans d introduction commencent en haut', () => {
  // Centres verticalement, ils rataient des deux cotes : un contenu court
  // laissait un grand vide au-dessus du logo, un contenu long se faisait
  // couper le haut, hors de la zone atteignable.
  assert.match(regle('.depart-en-haut'), /justify-content:\s*flex-start/);
  for (const id of ['boot-screen', 'intro-screen'])
    assert.match(MOTEUR, new RegExp(`id="${id}" class="screen depart-en-haut"`),
      `#${id} ne part pas du haut`);
  // La page de securite porte la classe sur son conteneur interieur, qui est
  // celui qui a la hauteur.
  assert.match(MOTEUR, /class="depart-en-haut" style="display:flex/);
  // Et l'ancien centrage ne doit pas revenir par la bande.
  assert.doesNotMatch(MOTEUR, /centre-sans-couper/);
});

test('le nom du jeu s adapte a la largeur de l ecran', () => {
  // « PROJET 1986 » tient a 1,8 rem ; « BOUFFEURS DE PIZZA » non. Une taille
  // fixe faisait deborder les noms longs.
  const r = regle('#boot-screen .logo');
  assert.match(r, /font-size:\s*clamp\(/);
  assert.match(r, /letter-spacing:\s*clamp\(/);
  assert.match(r, /overflow-wrap:\s*anywhere/);
});

test('l avatar ne mange pas l ecran sur un petit telephone', () => {
  assert.match(regle('#boot-screen img'), /max-width:\s*min\(/);
});

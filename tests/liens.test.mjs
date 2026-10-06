// Les liens que l'organisateur donne aux joueurs.
//
// La console affichait le slug et le code, jamais l'adresse a envoyer : il
// fallait la reconstruire de tete. Et deux chemins ne marchaient pas :
//   — un joueur cree par l'organisateur (pseudo + mot de passe, aucun code)
//     ouvrait rejoindre.html?slug=… et on lui reclamait un code d'invitation ;
//   — index.html?slug=… renvoyait vers rejoindre.html en perdant le slug, donc
//     sur un formulaire qui ne disait meme pas quel jeu on rejoignait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ADMIN = readFileSync('public/admin.html', 'utf8');
const REJOINDRE = readFileSync('public/rejoindre.html', 'utf8');
const MOTEUR = readFileSync('public/index.html', 'utf8');
const CODES = readFileSync('netlify/functions/codes-list.js', 'utf8');

test('la console fabrique les liens joueur depuis l origine courante', () => {
  // `location.origin` : le lien doit valoir pour le domaine reellement servi,
  // pas pour une adresse ecrite en dur quelque part.
  assert.match(ADMIN, /const lienCode = code => location\.origin \+ '\/rejoindre\.html\?code=' \+ encodeURIComponent\(code\)/);
  assert.match(ADMIN, /const lienJeu\s+= slug => location\.origin \+ '\/rejoindre\.html\?slug=' \+ encodeURIComponent\(slug\)/);
});

test('chaque tableau offre un bouton de copie', () => {
  assert.match(ADMIN, /onclick="copierLienJeu\('\$\{esc\(j\.slug\)\}',this\)"/, 'liste des jeux');
  assert.match(ADMIN, /onclick="copierLienCode\('\$\{esc\(c\.code\)\}',this\)"/, 'liste des codes');
  // Et les trois boutons passent par le meme presse-papier, replis compris.
  assert.match(ADMIN, /function copierTexte\(lien, btn\)/);
  for (const f of ['copierLien', 'copierLienCode', 'copierLienJeu'])
    assert.match(ADMIN, new RegExp(`function ${f}\\([^)]*\\)\\s*\\{[^}]*copierTexte`));
});

test('la liste des codes sait si le jeu est publie', () => {
  // Un code ne resout que sur un jeu publie (code-resolve.js) : sans la colonne
  // `statut`, la console propose un lien que le joueur ne peut pas ouvrir.
  const select = CODES.match(/\.select\('([^']+)'\)/)[1];
  assert.match(select, /jeu:jeux\([^)]*\bstatut\b[^)]*\)/,
    `la selection des codes ne remonte pas le statut du jeu : ${select}`);
  assert.match(ADMIN, /c\.jeu && c\.jeu\.statut==='publie'/);
  assert.match(ADMIN, /jeu non publie/);
});

test('se connecter ne reclame pas de code quand le slug est dans l URL', () => {
  assert.match(REJOINDRE, /let slugURL = ''/);
  assert.match(REJOINDRE, /const slug = \(currentGame && currentGame\.slug\) \|\| \(mode === 'login' \? slugURL : ''\)/);
  // L'inscription, elle, reste conditionnee au code : c'est lui le droit d'entree.
  assert.match(REJOINDRE, /mode === 'login'\s*\?\s*"Ouvre le lien/);
  assert.match(REJOINDRE, /slugURL = slug;/);
  // Et l'email technique se fabrique avec ce slug, pas avec currentGame.
  assert.match(REJOINDRE, /const email = synthEmail\(pseudo, slug\)/);
  assert.match(REJOINDRE, /function goToGame\(slug\)/);
  assert.doesNotMatch(REJOINDRE, /currentGame\.slug\}`/,
    'goToGame lit encore currentGame, nul en connexion par slug');
});

test('le moteur garde le slug en renvoyant vers l inscription', () => {
  const garde = MOTEUR.match(/async function authGuard\(\)[\s\S]*?\n\}/)[0];
  assert.match(garde, /const retour = 'rejoindre\.html\?slug=' \+ encodeURIComponent\(slug\)/);
  assert.doesNotMatch(garde, /location\.replace\('rejoindre\.html'\)/,
    'une redirection perd encore le slug');
  // Les trois sorties du verrou passent par la meme adresse de retour.
  assert.equal((garde.match(/location\.replace\(retour\)/g) || []).length, 3);
});

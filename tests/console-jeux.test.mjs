// La console des jeux et le statut de publication.
//
// Un jeu publie s'affichait « Brouillon » et le bouton restait « Publier » :
// la liste ne renvoyait pas la colonne `statut`, la console lisait `undefined`
// et retombait sur « Brouillon » pour tout le monde. Publier fonctionnait —
// seul l'affichage mentait, ce qui est pire qu'une panne franche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LISTE = readFileSync('netlify/functions/jeux-list.js', 'utf8');
const STATUT = readFileSync('netlify/functions/jeu-statut.js', 'utf8');
const CONSOLE = readFileSync('public/admin.html', 'utf8');

test('la liste des jeux renvoie leur statut', () => {
  const select = LISTE.match(/\.select\('([^']+)'\)/);
  assert.ok(select, 'aucune selection de colonnes');
  const colonnes = select[1].split(',').map(c => c.trim());
  assert.ok(colonnes.includes('statut'),
    `la console lit « statut », la liste ne renvoie que : ${colonnes.join(', ')}`);
});

test('la console ne lit rien que la liste ne fournisse', () => {
  // Le vrai invariant : toute colonne que l'affichage consulte doit figurer
  // dans la selection. C'est ce qui a manque ici, et rien ne l'avait signale.
  const select = LISTE.match(/\.select\('([^']+)'\)/)[1]
    .split(',').map(c => c.trim());
  const rendu = CONSOLE.match(/async function renderJeux\(\)[\s\S]*?\n\}/)[0];
  const lues = new Set([...rendu.matchAll(/\bj\.([a-z_]+)\b/g)].map(m => m[1]));
  for (const c of lues)
    assert.ok(select.includes(c), `renderJeux lit « j.${c} », absent de la selection`);
});

test('une publication qui ne touche aucune ligne n est pas un succes', () => {
  // Sans `select()` apres l'update, PostgREST repond « ok » meme quand aucune
  // ligne ne correspond : la console affichait un succes sans que rien n'ait
  // change en base.
  assert.match(STATUT, /\.update\(\{ statut \}\)\.eq\('id', id\)\.select\('id'\)/);
  assert.match(STATUT, /if \(!maj \|\| !maj\.length\) return json\(\{ error: 'Jeu introuvable' \}, 404\)/);
});

test('publier reste bloque par les erreurs, et forcable', () => {
  // Les deux moities du contrat : le serveur refuse un jeu injouable, mais
  // l'organisateur peut passer outre en connaissance de cause.
  assert.match(STATUT, /if \(erreurs > 0 && !forcer\)/);
  assert.match(CONSOLE, /togglePublish\('\$\{esc\(id\)\}',false,true\)/);
  // Et le drapeau part vraiment au serveur.
  assert.match(CONSOLE, /body:\{ id, statut, forcer:!!forcer \}/);
});

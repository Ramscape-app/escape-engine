import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireManifest, typeImage } from '../netlify/functions/manifest.js';

const ASSETS = 'https://gpwdnflaxuuselxxkepn.supabase.co/storage/v1/object/public/assets/';

const jeu = (over = {}) => ({
  name: 'Mariage Dupont',
  branding: { avatar: 'mariage-dupont/photo.jpg' },
  theme: { colors: { bg: '#112233' } },
  ...over,
});

// Le defaut a corriger : deux jeux rendaient le meme manifeste, donc la meme
// application pour le telephone, donc aucune proposition d'installation.
test('deux jeux ont deux identites distinctes', () => {
  const a = construireManifest({ slug: 'jeu-a' }, jeu({ name: 'Jeu A' }));
  const b = construireManifest({ slug: 'jeu-b' }, jeu({ name: 'Jeu B' }));
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.start_url, b.start_url);
  assert.notEqual(a.name, b.name);
});

test('un jeu ouvert en test a sa propre identite, distincte du jeu publie', () => {
  const pub = construireManifest({ slug: 'mariage-dupont' }, jeu());
  const essai = construireManifest(
    { previewId: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0' }, jeu());
  assert.notEqual(essai.id, pub.id);
  assert.match(essai.id, /previewId=0f1e2d3c/);
  // Et il se nomme autrement, sinon les deux se confondent dans la liste des
  // applications installees.
  assert.equal(essai.name, 'Mariage Dupont (test)');
  assert.equal(pub.name, 'Mariage Dupont');
});

test('le slug prime sur le previewId', () => {
  const m = construireManifest({ slug: 'vrai', previewId: 'abc' }, jeu());
  assert.equal(m.start_url, '/index.html?slug=vrai');
  assert.equal(m.name, 'Mariage Dupont');
});

test('sans jeu trouve, un manifeste utilisable subsiste', () => {
  const m = construireManifest({ slug: 'inconnu' }, null);
  assert.equal(m.name, 'Escape Game');
  assert.equal(m.start_url, '/index.html?slug=inconnu');
  assert.equal(m.icons[0].src, ASSETS + 'icons/icon-512.png');
});

// « tous les icones doivent etre la photo de la page d'intro par appli »
test('l icone est la photo de la page d intro', () => {
  const m = construireManifest({ slug: 'mariage-dupont' }, jeu());
  for (const i of m.icons) {
    assert.equal(i.src, ASSETS + 'mariage-dupont/photo.jpg');
    assert.equal(i.type, 'image/jpeg');
    // Une photo n'a pas la marge qu'un masque Android rogne.
    assert.equal(i.purpose, 'any');
  }
  assert.deepEqual(m.icons.map(i => i.sizes), ['192x192', '512x512']);
});

test('une photo deja hebergee ailleurs n est pas prefixee', () => {
  const m = construireManifest({ slug: 'x' },
    jeu({ branding: { avatar: 'https://exemple.test/p.png' } }));
  assert.equal(m.icons[0].src, 'https://exemple.test/p.png');
});

test('une icone dessinee exprès l emporte sur la photo', () => {
  const m = construireManifest({ slug: 'x' },
    jeu({ branding: { avatar: 'photo.jpg', appIcon512: 'icones/app.png' } }));
  assert.equal(m.icons[0].src, ASSETS + 'icones/app.png');
});

test('la couleur de fond vient du theme du jeu', () => {
  assert.equal(construireManifest({ slug: 'x' }, jeu()).background_color, '#112233');
  assert.equal(construireManifest({ slug: 'x' }, jeu({ theme: null })).theme_color, '#0a0a0f');
});

test('un slug a caracteres speciaux reste une URL valide', () => {
  const m = construireManifest({ slug: 'a b&c' }, jeu());
  assert.equal(m.start_url, '/index.html?slug=a%20b%26c');
  assert.doesNotThrow(() => new URL(m.start_url, 'https://exemple.test'));
});

test('le type MIME suit l extension', () => {
  assert.equal(typeImage('a/b.JPG'), 'image/jpeg');
  assert.equal(typeImage('a/b.webp'), 'image/webp');
  assert.equal(typeImage('a/b.png?v=2'), 'image/png');
  assert.equal(typeImage('a/b.inconnu'), 'image/png');
  assert.equal(typeImage(''), 'image/png');
});

test('le nom court reste court', () => {
  const m = construireManifest({ slug: 'x' },
    jeu({ name: 'Un nom de jeu vraiment tres long' }));
  assert.ok(m.short_name.length <= 12);
});

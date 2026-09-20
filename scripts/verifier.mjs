#!/usr/bin/env node
// Verifications structurelles du depot.
//
// Elles reprennent ce qui etait fait a la main a chaque modification, plus les
// pieges deja rencontres : une requete qui enumere les colonnes d'une table
// etendue par migration (le bug du theme), un id reference par le JS mais absent
// du HTML, un bloc CSS desequilibre.
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PAGES = ['index', 'admin', 'editeur', 'rejoindre', 'catalogue', 'repondre']
  .map(n => `public/${n}.html`);
const echecs = [];
const ko = (fichier, message) => echecs.push({ fichier, message });
let controles = 0;

const lire = (p) => readFileSync(p, 'utf8');
const blocsScript = (src) =>
  [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

// ── 1. Syntaxe JavaScript ─────────────────────────────────────────────────
function verifierSyntaxe(code, etiquette) {
  controles++;
  const tmp = join(tmpdir(), `verif-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmp, code);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { ko(etiquette, 'syntaxe : ' + String(e.stderr || e).split('\n').slice(0, 3).join(' ')); }
  finally { try { unlinkSync(tmp); } catch {} }
}

const fonctions = readdirSync('netlify/functions').filter(f => f.endsWith('.js'));
for (const f of fonctions) verifierSyntaxe(lire(`netlify/functions/${f}`), `netlify/functions/${f}`);
for (const f of readdirSync('public/shared')) verifierSyntaxe(lire(`public/shared/${f}`), `public/shared/${f}`);
for (const p of PAGES) blocsScript(lire(p)).forEach((b, i) => verifierSyntaxe(b, `${p} (bloc ${i + 1})`));

// ── 2. Equilibre des blocs CSS ────────────────────────────────────────────
for (const p of PAGES) {
  const src = lire(p);
  if (!src.includes('<style>')) continue;
  controles++;
  const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
  const o = (css.match(/\{/g) || []).length, c = (css.match(/\}/g) || []).length;
  if (o !== c) ko(p, `CSS desequilibre : ${o} accolades ouvrantes pour ${c} fermantes`);
}

// ── 3. Les ids references par le JS existent dans le HTML ─────────────────
// Un id renomme cote HTML sans l'etre cote JS ne casse rien au chargement :
// la page se degrade en silence, exactement comme le theme l'a fait.
for (const p of PAGES) {
  controles++;
  const src = lire(p);
  const ids = new Set([
    ...[...src.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]),
    // ids poses par le script sur des elements crees a la volee
    ...[...src.matchAll(/\.id\s*=\s*'([a-zA-Z0-9_-]+)'/g)].map(m => m[1]),
  ]);
  const refs = new Set([
    ...[...src.matchAll(/\$\('([a-zA-Z0-9_-]+)'\)/g)].map(m => m[1]),
    ...[...src.matchAll(/getElementById\('([a-zA-Z0-9_-]+)'\)/g)].map(m => m[1]),
  ]);
  // ids assembles dynamiquement (nav-<vue>, view-<vue>) : resolus a la main
  for (const v of ['accueil','live','jeux','themes','joueurs','codes','biblio','stats','debrief'])
    { refs.delete('nav-' + v); refs.delete('view-' + v); }
  const manquants = [...refs].filter(r => !ids.has(r));
  if (manquants.length) ko(p, 'ids references mais absents du HTML : ' + manquants.join(', '));
}

// ── 4. Equilibre des balises ──────────────────────────────────────────────
for (const p of PAGES) {
  controles++;
  const src = lire(p);
  for (const t of ['div', 'button', 'nav', 'main', 'table']) {
    const o = (src.match(new RegExp(`<${t}\\b`, 'g')) || []).length;
    const c = (src.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (o !== c) ko(p, `<${t}> desequilibre : ${o} ouvertes, ${c} fermees`);
  }
}

// ── 5. Aucune requete n'enumere les colonnes d'une table extensible ───────
// C'est exactement le bug qui a fait basculer un jeu sur le theme par defaut :
// PostgREST rejette la requete entiere des qu'une colonne demandee n'existe pas.
const EXTENSIBLES = ['themes'];
for (const p of [...PAGES, ...fonctions.map(f => `netlify/functions/${f}`)]) {
  controles++;
  const src = lire(p);
  for (const table of EXTENSIBLES) {
    const motifs = [
      new RegExp(`from\\('${table}'\\)\\s*\\.select\\('(?!\\*')([^']+)'`, 'g'),
      new RegExp(`${table}\\((?!\\*\\))([a-z_,\\s]+)\\)`, 'g'),
    ];
    for (const re of motifs) {
      const m = re.exec(src);
      if (m) ko(p, `requete sur « ${table} » enumerant ses colonnes (${m[1].slice(0, 40)}…) — utiliser * pour survivre aux migrations`);
    }
  }
}

// ── 6. Aucun secret cote client ───────────────────────────────────────────
for (const p of PAGES) {
  controles++;
  const src = lire(p);
  if (/SUPABASE_SERVICE_KEY|service_role|sb_secret/.test(src))
    ko(p, 'reference a une cle de service dans une page publique');
}

// ── 7. Toute fonction mutatrice passe par requireAdmin ────────────────────
const PUBLIQUES = ['manifest.js', 'code-resolve.js', 'rejoindre.js', 'jeux-publics.js'];
const PARTAGES = ['_auth.js', '_suivi.js', '_complice.js', '_medias.js'];
// Les `repondre-*` sont publiques par construction : le complice n'a pas de
// compte. Elles ne sont pas pour autant dispensees d'authentification — le
// controle 8 exige `resoudreJeton` sur chacune. Une regle plutot qu'une liste,
// pour qu'une nouvelle ne puisse pas etre publique par oubli.
const estPubliqueComplice = (f) => f.startsWith('repondre-');
for (const f of fonctions) {
  if (PUBLIQUES.includes(f) || PARTAGES.includes(f) || estPubliqueComplice(f)) continue;
  controles++;
  if (!lire(`netlify/functions/${f}`).includes('requireAdmin'))
    ko(`netlify/functions/${f}`, 'fonction sans requireAdmin — ajoute-la aux publiques si c\'est voulu');
}

// ── 8. Toute fonction « repondre-* » passe par resoudreJeton ──────────────
// Le pendant de la regle precedente pour la seule autre porte d'entree du site.
// Un `repondre-*` qui lirait son `complice_id` depuis le corps de la requete
// laisserait n'importe quel porteur de lien ecrire chez les autres.
for (const f of fonctions) {
  if (!f.startsWith('repondre-')) continue;
  controles++;
  if (!lire(`netlify/functions/${f}`).includes('resoudreJeton'))
    ko(`netlify/functions/${f}`, 'fonction publique sans resoudreJeton — le jeton est la seule authentification du complice');
}

// ── 9. La page du complice ne touche pas directement a la base ────────────
// Elle est publique et son lien circule : elle ne doit porter ni cle Supabase,
// ni client, ni requete. Tout passe par les fonctions serveur.
controles++;
{
  const src = lire('public/repondre.html');
  if (/SUPABASE_ANON|createClient|sb_publishable/.test(src))
    ko('public/repondre.html', 'acces direct a Supabase depuis la page du complice — passer par les fonctions repondre-*');
}

// ── 10. Pas deux fonctions du meme nom dans une page ──────────────────────
// Ces pages sont des monolithes d'un seul tenant : deux `function truc()` y
// cohabitent sans erreur, la seconde ecrasant la premiere, et c'est un bouton
// au hasard qui se met a faire autre chose. Arrive une fois avec `basculer()`.
for (const p of PAGES) {
  controles++;
  const noms = new Map();
  for (const bloc of blocsScript(lire(p))) {
    for (const m of bloc.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm))
      noms.set(m[1], (noms.get(m[1]) || 0) + 1);
  }
  const doubles = [...noms].filter(([, n]) => n > 1).map(([nom]) => nom);
  if (doubles.length) ko(p, 'fonctions declarees deux fois : ' + doubles.join(', '));
}

// ── 11. Le bucket public ne s'ecrit que depuis deux endroits ──────────────
// Ce que les complices envoient atterrit dans le bucket PRIVE `reponses`. Le
// bucket `assets` est public : une URL devinable y suffit a tout lire. Le
// passage de l'un a l'autre est un geste d'administrateur, fichier par fichier
// (`media-promouvoir`), et c'est tout l'objet de la phase 3. Une fonction de
// confort qui ecrirait dans `assets` en contournerait la regle sans le dire.
// `createSignedUploadUrl` compte comme une ecriture : elle delegue le depot au
// navigateur, mais c'est bien le serveur qui l'autorise. La regle ne la
// couvrait pas, et une fonction pouvait donc ouvrir le bucket public sans
// declencher le controle.
const ECRIVENT_ASSETS = ['asset-upload.js', 'asset-url.js', 'media-promouvoir.js'];
for (const f of fonctions) {
  if (ECRIVENT_ASSETS.includes(f)) continue;
  controles++;
  if (/from\(['"]assets['"]\)\s*\.\s*(upload|copy|move|createSignedUploadUrl)/.test(lire(`netlify/functions/${f}`)))
    ko(`netlify/functions/${f}`, 'ecriture dans le bucket public « assets » — la promotion passe par media-promouvoir');
}

// ── 12. Tout champ de saisie utilise porte une regle de style ─────────────
// `admin.html` a affiche pendant des mois des `textarea` au style par defaut du
// navigateur — fond blanc dans une console sombre — parce que l'element
// manquait a la regle de base. Rien ne le signalait : la page s'affichait.
// Le critere n'est pas « une regle existe » mais « une regle lui donne un
// fond ». C'est la nuance qui compte : `admin.html` avait bien un
// `.projetgrid textarea{resize:vertical}`, et ses champs longs restaient blancs.
// On cherche donc les selecteurs qui declarent `background`, puis on verifie
// que chaque champ est atteint par l'un d'eux, par son type ou par une classe.
const PAS_UN_CHAMP = /type="(hidden|file|checkbox|radio|color|range|submit|button)"/;

for (const p of PAGES) {
  const src = lire(p);
  if (!src.includes('<style>')) continue;
  const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'))
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Les selecteurs qui posent un fond, decoupes en jetons exploitables.
  const typesAvecFond = new Set(), classesAvecFond = new Set();
  for (const regle of css.split('}')) {
    const i = regle.indexOf('{');
    if (i < 0) continue;
    const decls = regle.slice(i + 1);
    if (!/(^|[;\s])background(-color)?\s*:/.test(decls)) continue;
    for (const sel of regle.slice(0, i).split(',')) {
      // Le dernier jeton du selecteur est ce qu'il cible reellement.
      const cible = sel.trim().split(/[\s>+~]+/).pop() || '';
      const base = cible.replace(/:[a-z-]+(\([^)]*\))?/g, '').replace(/\[[^\]]*\]/g, '');
      if (/^[a-z]+$/.test(base)) typesAvecFond.add(base);
      for (const c of base.matchAll(/\.([a-zA-Z][\w-]*)/g)) classesAvecFond.add(c[1]);
    }
  }

  for (const balise of ['input', 'select', 'textarea']) {
    if (!new RegExp(`<${balise}\\b`).test(src)) continue;
    controles++;
    if (typesAvecFond.has(balise)) continue;
    const nus = [];
    for (const m of src.matchAll(new RegExp(`<${balise}\\b([^>]*)>`, 'g'))) {
      if (PAS_UN_CHAMP.test(m[1])) continue;
      const brut = (m[1].match(/class="([^"]*)"/) || [, ''])[1];
      // Une classe entierement calculee (`class="${cls}"`) n'est pas lisible
      // ici : on ne peut ni la confirmer ni l'accuser, donc on passe.
      if (/\$\{/.test(brut)) continue;
      const cls = brut.split(/\s+/).filter(Boolean);
      if (!cls.some(c => classesAvecFond.has(c))) nus.push(m[0].slice(0, 44));
    }
    if (nus.length)
      ko(p, `${nus.length} <${balise}> auxquels aucune regle ne donne de fond `
        + `— ils s'afficheront en blanc. Ex. ${nus[0]}…`);
  }
}

// ── 13. Aucune page ne code en dur une source de tuiles ───────────────────
// Elles etaient en dur dans deux pages. Le jour ou CARTO s'est mis a exiger
// une cle d'API, les deux cartes se sont couvertes d'un filigrane « API KEY
// REQUIRED » — sans erreur, sans trace, et visible seulement par un joueur en
// pleine partie. Une seule declaration, dans `shared/carte.js`.
const TUILES = /['"`]https?:\/\/[^'"`]*\{z\}[^'"`]*['"`]|basemaps\.cartocdn|tile\.openstreetmap/;
for (const p of [...PAGES, ...readdirSync('public/module').filter(f => f.endsWith('.html')).map(f => `public/module/${f}`)]) {
  controles++;
  if (TUILES.test(lire(p)))
    ko(p, 'source de tuiles ecrite en dur — la declarer dans public/shared/carte.js');
}

// ── Verdict ───────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`\n✗ ${echecs.length} probleme(s) sur ${controles} controles\n`);
  for (const e of echecs) console.error(`  ${e.fichier}\n    ${e.message}`);
  process.exit(1);
}
console.log(`✓ ${controles} controles passes — ${fonctions.length} fonctions, ${PAGES.length} pages`);

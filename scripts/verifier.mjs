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

const PAGES = ['index', 'admin', 'editeur', 'rejoindre', 'catalogue'].map(n => `public/${n}.html`);
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
const PUBLIQUES = ['manifest.js', 'code-resolve.js', 'rejoindre.js', 'jeux-publics.js', '_auth.js', '_suivi.js'];
for (const f of fonctions) {
  if (PUBLIQUES.includes(f)) continue;
  controles++;
  if (!lire(`netlify/functions/${f}`).includes('requireAdmin'))
    ko(`netlify/functions/${f}`, 'fonction sans requireAdmin — ajoute-la aux publiques si c\'est voulu');
}

// ── Verdict ───────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`\n✗ ${echecs.length} probleme(s) sur ${controles} controles\n`);
  for (const e of echecs) console.error(`  ${e.fichier}\n    ${e.message}`);
  process.exit(1);
}
console.log(`✓ ${controles} controles passes — ${fonctions.length} fonctions, ${PAGES.length} pages`);

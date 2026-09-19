import { chromium } from 'playwright-core';
import { globSync } from 'node:fs';

// Chromium n'est pas une dependance du projet : on le cherche la ou Playwright
// l'installe, et `CHROME=` permet de pointer ailleurs.
const CHROME = process.env.CHROME
  || globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome')[0]
  || '/usr/bin/chromium';

const KIT = new URL('./admin-design-kit', import.meta.url).pathname;
const url = 'file://' + KIT + '/atelier.html';

const navigateur = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

// Deux largeurs : le poste de travail où la console sert vraiment, et le
// téléphone, où l'organisateur la consulte pendant une soirée.
const formats = [
  { nom: 'atelier-bureau', largeur: 1440, hauteur: 900 },
  { nom: 'atelier-mobile', largeur: 390, hauteur: 844 },
];

for (const f of formats) {
  const page = await navigateur.newPage({ viewport: { width: f.largeur, height: f.hauteur } });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${KIT}/captures/${f.nom}.png`, fullPage: true });
  console.log('✓', f.nom);
  await page.close();
}

// Quelques gros plans : ce qu'on regarde vraiment quand on juge une console.
const gros = [
  ['clients', '.clientgrid'],
  ['compositeur', '.modalbox.large'],
  ['suivi-direct', '.livegrid'],
  ['theme', '.themewrap'],
  ['matiere', '.matsec'],
];
const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(300);
for (const [nom, sel] of gros) {
  const el = await page.$(sel);
  if (!el) { console.log('—', nom, 'introuvable'); continue; }
  await el.screenshot({ path: `${KIT}/captures/detail-${nom}.png` });
  console.log('✓ detail-' + nom);
}

await navigateur.close();

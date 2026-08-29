#!/usr/bin/env node
// Calcule les empreintes SRI des dependances chargees depuis jsDelivr.
//
// jsDelivr sert le contenu des paquets npm a l'octet pres : l'empreinte se
// calcule donc depuis node_modules, sans dependre d'un acces reseau. Relancer
// ce script apres toute montee de version, et reporter les valeurs dans les
// pages — sans quoi le navigateur refusera de charger le script.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const versions = {
  supabase: JSON.parse(readFileSync('node_modules/@supabase/supabase-js/package.json', 'utf8')).version,
  leaflet: JSON.parse(readFileSync('node_modules/leaflet/package.json', 'utf8')).version,
};

const cibles = [
  ['node_modules/@supabase/supabase-js/dist/umd/supabase.js',
   `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${versions.supabase}/dist/umd/supabase.js`],
  ['node_modules/leaflet/dist/leaflet.js',
   `https://cdn.jsdelivr.net/npm/leaflet@${versions.leaflet}/dist/leaflet.js`],
  ['node_modules/leaflet/dist/leaflet.css',
   `https://cdn.jsdelivr.net/npm/leaflet@${versions.leaflet}/dist/leaflet.css`],
];

for (const [fichier, url] of cibles) {
  const sri = 'sha384-' + createHash('sha384').update(readFileSync(fichier)).digest('base64');
  console.log(`${url}\n  ${sri}\n`);
}

import { adminClient, requireAdmin } from './_auth.js';

const TYPES_AUTORISES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const TAILLE_MAX = 5 * 1024 * 1024;   // 5 Mo

// Nettoie un fragment de chemin : accents retirés, caractères douteux remplacés.
// Appliqué au slug comme au nom de fichier, sinon un slug contenant « ../ »
// écrivait hors de son dossier.
const propre = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9.\-_]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { slug, filename, dataBase64, contentType } = await req.json();
  if (!slug || !filename || !dataBase64) return json({ error: 'slug, filename et image requis' }, 400);

  const type = contentType || 'image/jpeg';
  if (!TYPES_AUTORISES.includes(type)) {
    return json({ error: 'Format non accepté. Formats autorisés : JPEG, PNG, GIF, WebP, SVG.' }, 400);
  }

  const dossier = propre(slug);
  const clean = propre(filename);
  if (!dossier || !clean) return json({ error: 'slug ou nom de fichier invalide' }, 400);
  const path = `${dossier}/${Date.now()}-${clean}`;   // ex: mariage-dupont/1720000000-photo.png

  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length > TAILLE_MAX) {
    return json({ error: 'Image trop lourde (5 Mo maximum).' }, 413);
  }

  const sb = adminClient();
  const { error } = await sb.storage.from('assets').upload(path, buffer, {
    contentType: type, upsert: false,
  });
  if (error) return json({ error: error.message }, 500);

  // Renvoie le chemin relatif (que l'éditeur stockera dans la config, prefixé par assetUrl côté moteur)
  return json({ ok: true, path });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

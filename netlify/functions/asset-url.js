import { adminClient, requireAdmin, json } from './_auth.js';

// Delivre une URL signee pour deposer un fichier dans le bucket PUBLIC `assets`.
//   POST { slug, filename, type, taille }
//   → { url, path }
//
// Pourquoi a cote de `asset-upload` plutot qu'en le remplacant : celle-ci fait
// transiter le fichier en base64 dans le corps de la fonction, ce qui plafonne
// a quelques megaoctets et exclut donc l'audio. Une musique d'intro de trois
// minutes pese plus que ca. Ici le navigateur depose directement dans Supabase,
// sur un chemin decide par le serveur.
//
// ⚠️ `assets` est PUBLIC : tout ce qui y entre est lisible par quiconque devine
//    l'URL. C'est voulu — le moteur de jeu lit ce bucket sans authentification —
//    mais cela vaut pour l'habillage d'un jeu, pas pour ce que des proches
//    confient. Les medias des complices vivent dans le bucket prive `reponses`
//    et n'arrivent ici que par `media-promouvoir`, sur un geste explicite.

// L'extension vient du type declare, jamais du nom de fichier envoye.
export const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'weba',
};

// Pas de `image/svg+xml`, contrairement a `asset-upload` : un SVG est un
// document executable, servi ici depuis un domaine public. Rien dans
// l'habillage d'un jeu n'en a besoin.

export const TAILLE_MAX = 25 * 1024 * 1024;   // 25 Mo : une piste d'intro tient large

// Nettoie un fragment de chemin. Sans ca, un slug contenant « ../ » ecrirait
// hors de son dossier.
export const propre = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9.\-_]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');

// Le nom d'origine est conserve — l'organisateur doit reconnaitre ses fichiers
// dans la console Supabase — mais nettoye, prive de son extension d'origine, et
// prefixe d'un horodatage pour qu'aucun envoi n'en ecrase un autre.
export function cheminAsset(dossier, nom, ext, horodatage) {
  const base = propre(String(nom || 'fichier').replace(/\.[^.]*$/, '')) || 'fichier';
  return `${dossier}/${horodatage || Date.now()}-${base.slice(0, 60)}.${ext}`;
}

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const type = String(body.type || '').toLowerCase();
  const ext = TYPES[type];
  if (!ext) return json({
    error: 'Format non accepté. Images (JPEG, PNG, WebP, GIF) et sons (MP3, M4A, OGG, WAV).',
  }, 400);

  const taille = Number(body.taille) || 0;
  if (taille > TAILLE_MAX) return json({
    error: `Fichier trop lourd (${Math.round(TAILLE_MAX / 1024 / 1024)} Mo maximum).`,
  }, 413);

  const dossier = propre(body.slug || '');
  if (!dossier) return json({ error: 'slug requis' }, 400);

  const path = cheminAsset(dossier, body.filename, ext);

  const sb = adminClient();
  const { data, error } = await sb.storage.from('assets').createSignedUploadUrl(path);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, url: data.signedUrl, path });
};

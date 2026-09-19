import { adminClient, requireAdmin, json } from './_auth.js';
import { BUCKET } from './_medias.js';

// URL de lecture temporaire pour un média du bucket privé.
//   POST { paths: ['<complice>/<question>/<aleatoire>.jpg', ...] }
//   → { urls: { path: url } }
//
// Le bucket est privé : il n'existe pas d'URL permanente, et c'est le but. Une
// signature d'une heure suffit à consulter les photos dans l'admin, et rien ne
// reste partageable ensuite par inadvertance.
//
// Les chemins demandés sont vérifiés contre la base et non contre leur forme :
// seul un chemin réellement présent dans `reponses.medias` est signé. Un
// administrateur n'a de toute façon aucune raison de lire ailleurs, et ça évite
// de transformer cette fonction en lecteur universel du stockage.
const DUREE = 3600;
const MAX = 60;

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const demandes = Array.isArray(body.paths) ? body.paths.slice(0, MAX).map(String) : [];
  if (!demandes.length) return json({ ok: true, urls: {} });

  const sb = adminClient();
  const { data, error } = await sb.from('reponses').select('medias');
  if (error) return json({ error: error.message }, 500);

  const connus = new Set();
  (data || []).forEach(r => {
    (Array.isArray(r.medias) ? r.medias : []).forEach(m => { if (m && m.path) connus.add(m.path); });
  });

  const urls = {};
  for (const p of demandes) {
    if (!connus.has(p)) continue;
    const { data: sig } = await sb.storage.from(BUCKET).createSignedUrl(p, DUREE);
    if (sig && sig.signedUrl) urls[p] = sig.signedUrl;
  }

  return json({ ok: true, urls });
};

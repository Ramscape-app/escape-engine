import { adminClient, requireAdmin, json } from './_auth.js';
import { BUCKET, TYPES } from './_medias.js';

// Fait passer un média du bucket privé `reponses` au bucket public `assets`,
// pour qu'une énigme puisse l'afficher.
//   POST { path, slug }
//   → { ok, chemin_public }
//
// ⚠️ C'est LE geste qui rend une photo de famille publiquement accessible.
//    Il n'arrive jamais tout seul : ni à l'envoi, ni à la consultation, ni à la
//    création d'un jeu. Seul un administrateur, fichier par fichier, une fois
//    qu'il sait que la photo servira dans une énigme.
//
// La copie est une copie : l'original reste dans le bucket privé. Retirer la
// photo du jeu plus tard ne doit pas faire disparaître la matière collectée.
const propre = (s) => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9.\-_]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const path = String(body.path || '');
  const dossier = propre(body.slug || 'clients');
  if (!path || !dossier) return json({ error: 'path et slug requis' }, 400);

  const sb = adminClient();

  // Le chemin doit venir de `reponses.medias` : on ne promeut que ce qu'un
  // complice a réellement envoyé, jamais un chemin dicté par l'appel.
  const { data: lignes, error: eLire } = await sb.from('reponses').select('*');
  if (eLire) return json({ error: eLire.message }, 500);

  let ligne = null, media = null;
  for (const r of lignes || []) {
    const m = (Array.isArray(r.medias) ? r.medias : []).find(x => x && x.path === path);
    if (m) { ligne = r; media = m; break; }
  }
  if (!media) return json({ error: 'Média inconnu.' }, 404);
  if (media.promu) return json({ ok: true, chemin_public: media.promu, deja: true });
  if (!TYPES[media.type]) return json({ error: 'Format non promouvable.' }, 400);

  const { data: fichier, error: eTelech } = await sb.storage.from(BUCKET).download(path);
  if (eTelech || !fichier) return json({ error: 'Fichier introuvable dans le stockage.' }, 404);

  const ext = TYPES[media.type];
  const cheminPublic = `${dossier}/complices/${Date.now()}-${path.split('/').pop()}`;
  const buffer = Buffer.from(await fichier.arrayBuffer());

  const { error: eEnvoi } = await sb.storage.from('assets')
    .upload(cheminPublic, buffer, { contentType: media.type, upsert: false });
  if (eEnvoi) return json({ error: eEnvoi.message }, 500);

  // On note la promotion sur le média : l'admin doit pouvoir voir d'un coup
  // d'œil ce qui est déjà public, et ne pas le promouvoir deux fois.
  const medias = ligne.medias.map(m => m.path === path ? { ...m, promu: cheminPublic } : m);
  await sb.from('reponses').update({ medias }).eq('id', ligne.id);

  return json({ ok: true, chemin_public: cheminPublic, ext });
};

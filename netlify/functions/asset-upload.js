import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { slug, filename, dataBase64, contentType } = await req.json();
  if (!slug || !filename || !dataBase64) return json({ error: 'slug, filename et image requis' }, 400);

  // Nettoie le nom de fichier et range dans un sous-dossier par jeu
  const clean = String(filename).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\-_]+/g, '-').replace(/^-+|-+$/g, '');
  const path = `${slug}/${Date.now()}-${clean}`;   // ex: mariage-dupont/1720000000-photo.png

  const buffer = Buffer.from(dataBase64, 'base64');
  const sb = adminClient();
  const { error } = await sb.storage.from('assets').upload(path, buffer, {
    contentType: contentType || 'image/jpeg', upsert: false,
  });
  if (error) return json({ error: error.message }, 500);

  // Renvoie le chemin relatif (que l'éditeur stockera dans la config, prefixé par assetUrl côté moteur)
  return json({ ok: true, path });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

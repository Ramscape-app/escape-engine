import { adminClient, requireAdmin, json } from './_auth.js';

// Suppression d'une fiche client.
// Les jeux rattaches ne sont PAS supprimes : `jeux.client_id` passe a null
// (on delete set null). Un jeu livre survit a l'archivage de son client.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }
  if (!body.id) return json({ error: 'id requis' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('clients').delete().eq('id', body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

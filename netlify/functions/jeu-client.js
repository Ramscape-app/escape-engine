import { adminClient, requireAdmin, json } from './_auth.js';

// Rattache un jeu a une fiche client, ou l'en detache (client_id = null).
// Sert surtout a reprendre les jeux crees avant l'arrivee des fiches clients.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }
  if (!body.jeu_id) return json({ error: 'jeu_id requis' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('jeux')
    .update({ client_id: body.client_id || null }).eq('id', body.jeu_id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

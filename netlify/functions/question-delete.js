import { adminClient, requireAdmin, json } from './_auth.js';

// Retire une question du catalogue.
//
// Par defaut on la desactive plutot que de la supprimer : des reponses deja
// collectees y font reference, et les perdre effacerait de la matiere d'enigme.
// `definitif: true` supprime vraiment, a n'utiliser que sur une question jamais
// posee.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }
  if (!body.id) return json({ error: 'id requis' }, 400);

  const sb = adminClient();
  if (body.definitif) {
    const { error } = await sb.from('questions').delete().eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, supprime: true });
  }
  const { error } = await sb.from('questions').update({ actif: false }).eq('id', body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, desactive: true });
};

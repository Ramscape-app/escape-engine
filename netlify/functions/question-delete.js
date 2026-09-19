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
    // Une question deja posee a des reponses qui la citent. `reponses` n'a pas
    // de cle etrangere vers `questions` — c'est voulu, pour qu'aucune
    // suppression n'efface de la matiere collectee — donc le garde-fou est ici.
    const { count } = await sb.from('reponses')
      .select('id', { count: 'exact', head: true }).eq('question_id', body.id);
    if (count) return json({
      error: `Cette question porte ${count} réponse(s) déjà collectée(s). Désactive-la plutôt.`,
      reponses: count,
    }, 409);

    const { error } = await sb.from('questions').delete().eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, supprime: true });
  }
  const { error } = await sb.from('questions').update({ actif: false }).eq('id', body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, desactive: true });
};

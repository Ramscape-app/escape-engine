import { adminClient, requireAdmin, json } from './_auth.js';

// Suppression d'un questionnaire.
//
// La cascade emporte ses complices ET leurs reponses : c'est de la matiere
// d'enigme deja collectee, parfois irremplacable (le complice ne repondra pas
// deux fois). On refuse donc tant qu'il reste des reponses, sauf `force: true`
// demande explicitement apres avertissement.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }
  if (!body.id) return json({ error: 'id requis' }, 400);

  const sb = adminClient();

  if (!body.force) {
    const { data: cs } = await sb.from('complices')
      .select('id').eq('questionnaire_id', body.id);
    const ids = (cs || []).map(c => c.id);
    if (ids.length) {
      const { count } = await sb.from('reponses')
        .select('id', { count: 'exact', head: true }).in('complice_id', ids);
      if (count) return json({
        error: `Ce questionnaire porte ${count} réponse(s) déjà collectée(s).`,
        reponses: count,
      }, 409);
    }
  }

  const { error } = await sb.from('questionnaires').delete().eq('id', body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

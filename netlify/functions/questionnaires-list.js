import { adminClient, requireAdmin, json } from './_auth.js';

// Les questionnaires d'un client, avec leurs complices et l'avancement de
// chacun.
//   GET ?client_id=<uuid>
//
// L'avancement est ce qu'on vient chercher ici : savoir qui n'a pas ouvert son
// lien evite de relancer celui qui a deja tout rempli.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const clientId = new URL(req.url).searchParams.get('client_id');
  if (!clientId) return json({ error: 'client_id requis' }, 400);

  const sb = adminClient();
  const { data: qs, error } = await sb.from('questionnaires')
    .select('*').eq('client_id', clientId).order('created_at');
  if (error) return json({
    error: `${error.message} — la migration 08 a-t-elle ete jouee ?`,
  }, 500);

  const ids = (qs || []).map(q => q.id);
  let complices = [];
  if (ids.length) {
    const { data } = await sb.from('complices')
      .select('*').in('questionnaire_id', ids).order('created_at');
    complices = data || [];
  }

  // Le nombre de reponses non vides par complice : c'est le seul chiffre qui
  // dit vraiment ou en est quelqu'un.
  const compte = {};
  if (complices.length) {
    const { data } = await sb.from('reponses')
      .select('complice_id, valeur').in('complice_id', complices.map(c => c.id));
    (data || []).forEach(r => {
      if (r.valeur && String(r.valeur).trim()) compte[r.complice_id] = (compte[r.complice_id] || 0) + 1;
    });
  }

  const questionnaires = (qs || []).map(q => ({
    ...q,
    complices: complices
      .filter(c => c.questionnaire_id === q.id)
      .map(c => ({ ...c, repondues: compte[c.id] || 0 })),
  }));

  return json({ ok: true, questionnaires });
};

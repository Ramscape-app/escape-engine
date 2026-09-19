import { adminClient, requireAdmin, json } from './_auth.js';

// La matiere collectee pour un client.
//   GET ?client_id=<uuid>
//
// Renvoie les reponses de tous ses complices, enrichies de l'ingredient de
// chaque question. C'est ce regroupement par ingredient qui fait la difference
// entre une liste de reponses et un plan de travail : « voici les six chiffres
// dont tu disposes » au moment de poser un cadenas.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const clientId = new URL(req.url).searchParams.get('client_id');
  if (!clientId) return json({ error: 'client_id requis' }, 400);

  const sb = adminClient();

  const { data: qs, error: eq } = await sb.from('questionnaires')
    .select('id').eq('client_id', clientId);
  if (eq) return json({
    error: `${eq.message} — la migration 08 a-t-elle ete jouee ?`,
  }, 500);
  if (!qs || !qs.length) return json({ ok: true, reponses: [], complices: [] });

  const { data: cs } = await sb.from('complices')
    .select('*').in('questionnaire_id', qs.map(q => q.id));
  const complices = cs || [];
  if (!complices.length) return json({ ok: true, reponses: [], complices: [] });

  const [repR, catR] = await Promise.all([
    sb.from('reponses').select('*').in('complice_id', complices.map(c => c.id)),
    sb.from('questions').select('*'),
  ]);
  if (repR.error) return json({ error: repR.error.message }, 500);

  const parQuestion = {};
  (catR.data || []).forEach(q => { parQuestion[q.id] = q; });
  const parComplice = {};
  complices.forEach(c => { parComplice[c.id] = c; });

  // Une question retiree du catalogue laisse ses reponses lisibles : c'est tout
  // l'interet de `libelle_pose`, copie au moment ou la question a ete posee.
  const reponses = (repR.data || [])
    .filter(r => (r.valeur && String(r.valeur).trim())
      || (Array.isArray(r.medias) && r.medias.length))
    .map(r => {
      const q = parQuestion[r.question_id];
      const c = parComplice[r.complice_id];
      return {
        question_id: r.question_id,
        libelle: r.libelle_pose || (q && q.libelle) || r.question_id,
        section: (q && q.section) || 'autre',
        ingredient: (q && q.ingredient) || 'recit',
        valeur: r.valeur,
        medias: Array.isArray(r.medias) ? r.medias : [],
        complice: c ? c.nom : '?',
        complice_id: r.complice_id,
        updated_at: r.updated_at,
      };
    });

  return json({
    ok: true,
    reponses,
    complices: complices.map(c => ({ id: c.id, nom: c.nom, relation: c.relation })),
  });
};

import { adminClient, requireAdmin, json } from './_auth.js';
import { nouveauJeton } from './_complice.js';

// Cree un complice et son lien.
//   POST { questionnaire_id, nom, relation? }
//
// Le jeton est tire ici, cote serveur : le navigateur ne choisit jamais le
// secret qui ouvre un questionnaire.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const nom = String(body.nom || '').trim();
  if (!body.questionnaire_id) return json({ error: 'questionnaire_id requis' }, 400);
  if (!nom) return json({ error: 'Le nom du complice est requis.' }, 400);

  const sb = adminClient();
  const { data, error } = await sb.from('complices').insert({
    questionnaire_id: body.questionnaire_id,
    nom,
    relation: String(body.relation || '').trim() || null,
    jeton: nouveauJeton(),
  }).select('*').single();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, complice: data });
};

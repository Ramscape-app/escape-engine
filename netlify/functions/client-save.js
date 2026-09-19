import { adminClient, requireAdmin, json } from './_auth.js';

const STATUTS = ['prospect', 'en_cours', 'livre', 'archive'];

// Creation ou mise a jour d'une fiche client.
//   POST { id?, nom, contact_nom, email, telephone, projet, note, statut }
//
// `projet` est la fiche projet : evenement, format, lieux, budget, logistique.
// Elle ne quitte jamais l'admin — un complice ne doit pas voir le budget.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const nom = String(body.nom || '').trim();
  if (!nom) return json({ error: 'Le nom du client est requis.' }, 400);
  if (body.statut && !STATUTS.includes(body.statut))
    return json({ error: 'Statut inconnu.' }, 400);

  const ligne = {
    nom,
    contact_nom: String(body.contact_nom || '').trim() || null,
    email: String(body.email || '').trim() || null,
    telephone: String(body.telephone || '').trim() || null,
    projet: (body.projet && typeof body.projet === 'object') ? body.projet : {},
    note: String(body.note || '').trim() || null,
    statut: body.statut || 'prospect',
    updated_at: new Date().toISOString(),
  };

  const sb = adminClient();
  if (body.id) {
    const { error } = await sb.from('clients').update(ligne).eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: body.id });
  }
  const { data, error } = await sb.from('clients').insert(ligne).select('id').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: data.id });
};

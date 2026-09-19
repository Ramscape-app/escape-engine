import { adminClient, requireAdmin, json } from './_auth.js';
import { nouveauJeton } from './_complice.js';

// Revoque ou supprime un complice.
//   POST { id, action: 'revoquer' | 'supprimer' }
//
// `revoquer` tire un nouveau jeton : l'ancien lien cesse de fonctionner, les
// reponses deja donnees restent. C'est ce qu'il faut quand un lien a ete
// transfere a la mauvaise personne — et c'est pour ca qu'un jeton par complice
// vaut mieux qu'un jeton par questionnaire.
//
// `supprimer` emporte les reponses en cascade : refuse s'il y en a, sauf
// `force: true`.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }
  if (!body.id) return json({ error: 'id requis' }, 400);

  const sb = adminClient();

  if (body.action === 'revoquer') {
    const jeton = nouveauJeton();
    const { error } = await sb.from('complices').update({ jeton }).eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, jeton });
  }

  if (!body.force) {
    const { count } = await sb.from('reponses')
      .select('id', { count: 'exact', head: true }).eq('complice_id', body.id);
    if (count) return json({
      error: `Ce complice a déjà donné ${count} réponse(s).`,
      reponses: count,
    }, 409);
  }

  const { error } = await sb.from('complices').delete().eq('id', body.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

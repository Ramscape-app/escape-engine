import { adminClient, requireAdmin, json } from './_auth.js';

// Message de l'organisateur à une équipe — un indice, un coup de pouce, un mot.
//
// Passe forcément par le serveur : la policy d'insertion des joueurs interdit
// `type = 'organisateur'`, personne ne peut donc se faire passer pour toi.
// Le moteur est déjà abonné à `activite` : le message arrive sans rechargement.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const equipe_id = body.equipe_id;
  const contenu = String(body.contenu || '').trim();
  if (!equipe_id) return json({ error: 'equipe_id requis' }, 400);
  if (!contenu) return json({ error: 'Le message est vide.' }, 400);
  if (contenu.length > 500) return json({ error: 'Message trop long (500 caractères maximum).' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('activite').insert({
    equipe_id, joueur_id: null, pseudo: null,
    type: 'organisateur', contenu,
    enigme_index: (body.enigme_index != null) ? parseInt(body.enigme_index, 10) : null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

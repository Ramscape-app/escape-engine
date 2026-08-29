import { adminClient, requireAdmin, json } from './_auth.js';
import { resoudreCible, refus } from './_suivi.js';

// Message de l'organisateur — un indice, un coup de pouce, un mot.
//   POST { equipe_id | joueur_id, contenu }
//
// Passe forcément par le serveur : la policy des joueurs leur interdit d'écrire
// un `type = 'organisateur'`, personne ne peut donc se faire passer pour toi.
// Le moteur est abonné à `activite` en équipe comme en solo : le message arrive
// sans rechargement.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const contenu = String(body.contenu || '').trim();
  if (!contenu) return json({ error: 'Le message est vide.' }, 400);
  if (contenu.length > 500) return json({ error: 'Message trop long (500 caractères maximum).' }, 400);

  const sb = adminClient();
  const cible = await resoudreCible(sb, body);
  if (cible.erreur) return refus(cible);

  const { error } = await sb.from('activite').insert({
    ...cible.activite,
    joueur_id: null, pseudo: null, type: 'organisateur', contenu,
    enigme_index: (body.enigme_index != null) ? parseInt(body.enigme_index, 10) : null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, cible: cible.nom });
};

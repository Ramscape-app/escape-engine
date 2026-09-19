import { adminClient, json } from './_auth.js';
import { resoudreJeton, libellePose, REFUS } from './_complice.js';

// Enregistre une reponse, au fil de la frappe.
//   POST { jeton, question_id, valeur }
//
// ⚠️ Fonction PUBLIQUE. Deux verrous :
//
//  1. La question doit appartenir au questionnaire de CE complice. Sans ce
//     controle, n'importe qui tenant un lien pourrait ecrire sous n'importe
//     quel `question_id` et polluer la matiere d'enigme d'un autre client.
//  2. La valeur est bornee. Un champ libre public sans plafond, c'est une table
//     qu'on remplit jusqu'a saturation avec une boucle.
//
// Le complice repond sur son telephone, entre deux choses : chaque champ quitte
// est enregistre seul, et rien ne se perd si l'onglet se ferme.
const MAX_VALEUR = 4000;

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const sb = adminClient();
  const complice = await resoudreJeton(sb, body.jeton);
  if (!complice) return json({ error: REFUS }, 404);

  const questionId = String(body.question_id || '').trim();
  const items = Array.isArray(complice.questionnaire.items) ? complice.questionnaire.items : [];
  const item = items.find(i => i && i.q === questionId);
  if (!item) return json({ error: 'Cette question ne fait pas partie de ce questionnaire.' }, 400);

  const valeur = String(body.valeur == null ? '' : body.valeur).slice(0, MAX_VALEUR);

  const { error } = await sb.from('reponses').upsert({
    complice_id: complice.id,
    question_id: questionId,
    libelle_pose: await libellePose(sb, item, questionId),
    valeur,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'complice_id,question_id' });

  if (error) return json({ error: 'Enregistrement impossible pour le moment.' }, 500);
  return json({ ok: true });
};

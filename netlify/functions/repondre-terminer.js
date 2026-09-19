import { adminClient, json } from './_auth.js';
import { resoudreJeton, REFUS } from './_complice.js';

// Le complice declare avoir fini.
//   POST { jeton }
//
// ⚠️ Fonction PUBLIQUE.
//
// C'est un signal, pas un verrou : le lien continue de fonctionner et les
// reponses restent modifiables. Quelqu'un qui se souvient d'un detail trois
// jours plus tard doit pouvoir revenir le corriger — l'enfermer dehors ferait
// perdre exactement la matiere qu'on cherche.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const sb = adminClient();
  const complice = await resoudreJeton(sb, body.jeton);
  if (!complice) return json({ error: REFUS }, 404);

  const { error } = await sb.from('complices')
    .update({ termine_le: new Date().toISOString() }).eq('id', complice.id);
  if (error) return json({ error: 'Enregistrement impossible pour le moment.' }, 500);
  return json({ ok: true });
};

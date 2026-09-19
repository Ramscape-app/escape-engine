import { adminClient, json } from './_auth.js';
import { resoudreJeton, REFUS } from './_complice.js';
import { BUCKET, TYPES, TAILLE_MAX, MAX_PAR_QUESTION, cheminMedia } from './_medias.js';

// Délivre une URL signée pour déposer UN fichier.
//   POST { jeton, question_id, type, taille }
//   → { url, path }
//
// ⚠️ Fonction PUBLIQUE.
//
// Pourquoi une URL signée et non un envoi à travers cette fonction : une photo
// de téléphone pèse plusieurs mégaoctets, que le corps d'une fonction serveur
// ne devrait pas avoir à porter. Le navigateur dépose donc le fichier
// directement dans Supabase — mais sur un chemin que LUI ne choisit pas, avec
// une signature valable quelques minutes, dans un bucket privé.
//
// Le fichier n'est rattaché à la réponse qu'à l'étape suivante
// (`repondre-media-confirmer`). Un dépôt jamais confirmé reste un objet orphelin
// dans un bucket privé : invisible, et récupérable par le ménage.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const sb = adminClient();
  const complice = await resoudreJeton(sb, body.jeton);
  if (!complice) return json({ error: REFUS }, 404);

  // La question doit appartenir à CE questionnaire : même verrou que pour
  // l'écriture d'une réponse texte.
  const questionId = String(body.question_id || '').trim();
  const items = Array.isArray(complice.questionnaire.items) ? complice.questionnaire.items : [];
  if (!items.some(i => i && i.q === questionId))
    return json({ error: 'Cette question ne fait pas partie de ce questionnaire.' }, 400);

  const type = String(body.type || '').toLowerCase();
  if (!TYPES[type]) return json({
    error: 'Format non accepté. Envoie une photo (JPEG, PNG, WebP, HEIC) ou un son.',
  }, 400);

  const taille = Number(body.taille) || 0;
  if (taille > TAILLE_MAX) return json({
    error: `Fichier trop lourd (${Math.round(TAILLE_MAX / 1024 / 1024)} Mo maximum).`,
  }, 413);

  // Le plafond se compte sur ce qui est déjà rattaché : c'est le seul décompte
  // qui ne dépend pas de ce que le navigateur affirme.
  const { data: dejaLa } = await sb.from('reponses')
    .select('medias').eq('complice_id', complice.id).eq('question_id', questionId).maybeSingle();
  const medias = (dejaLa && Array.isArray(dejaLa.medias)) ? dejaLa.medias : [];
  if (medias.length >= MAX_PAR_QUESTION) return json({
    error: `${MAX_PAR_QUESTION} fichiers maximum par question.`,
  }, 409);

  const path = cheminMedia(complice.id, questionId, type);
  if (!path) return json({ error: 'Format non accepté.' }, 400);

  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return json({ error: 'Envoi impossible pour le moment.' }, 500);

  return json({ ok: true, url: data.signedUrl, path });
};

import { adminClient, json } from './_auth.js';
import { resoudreJeton, libellePose, REFUS } from './_complice.js';
import {
  BUCKET, TYPES, TAILLE_MAX, MAX_PAR_QUESTION, cheminAutorise, entreeMedia,
} from './_medias.js';

// Rattache un fichier déposé à la réponse, ou le retire.
//   POST { jeton, question_id, path, nom?, type?, taille? }
//   POST { jeton, question_id, path, retirer: true }
//
// ⚠️ Fonction PUBLIQUE.
//
// Le navigateur annonce ce qu'il a déposé, donc on ne le croit pas : le chemin
// doit avoir la forme de ceux que le serveur émet ET être sous le dossier de CE
// complice, et l'objet doit exister réellement dans le bucket. Sans cette
// dernière vérification, n'importe qui pourrait remplir `medias` de chemins
// inventés.
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

  const path = String(body.path || '');
  if (!cheminAutorise(path, complice.id)) return json({ error: 'Chemin invalide.' }, 400);

  const { data: ligne } = await sb.from('reponses')
    .select('medias').eq('complice_id', complice.id).eq('question_id', questionId).maybeSingle();
  let medias = (ligne && Array.isArray(ligne.medias)) ? ligne.medias : [];

  if (body.retirer) {
    // Le complice se ravise. Le fichier part du bucket comme de la réponse :
    // garder l'objet ne servirait qu'à conserver une photo qu'on a demandé de
    // retirer.
    medias = medias.filter(m => m && m.path !== path);
    await sb.storage.from(BUCKET).remove([path]);
  } else {
    if (medias.some(m => m && m.path === path)) return json({ ok: true, medias });
    if (medias.length >= MAX_PAR_QUESTION)
      return json({ error: `${MAX_PAR_QUESTION} fichiers maximum par question.` }, 409);

    // L'objet est-il vraiment là, et fait-il le poids annoncé ? C'est le
    // stockage qui répond, pas le navigateur.
    const dossier = path.slice(0, path.lastIndexOf('/'));
    const nomFichier = path.slice(path.lastIndexOf('/') + 1);
    const { data: trouves } = await sb.storage.from(BUCKET)
      .list(dossier, { search: nomFichier, limit: 1 });
    const objet = (trouves || []).find(o => o.name === nomFichier);
    if (!objet) return json({ error: 'Fichier introuvable — réessaie l\'envoi.' }, 404);

    const taille = (objet.metadata && objet.metadata.size) || 0;
    const type = (objet.metadata && objet.metadata.mimetype) || String(body.type || '');
    if (taille > TAILLE_MAX || !TYPES[type]) {
      await sb.storage.from(BUCKET).remove([path]);
      return json({ error: 'Fichier refusé.' }, 400);
    }

    medias = medias.concat([entreeMedia({ path, nom: body.nom, type, taille })]);
  }

  const { error } = await sb.from('reponses').upsert({
    complice_id: complice.id,
    question_id: questionId,
    libelle_pose: await libellePose(sb, item, questionId),
    medias,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'complice_id,question_id' });
  if (error) return json({ error: 'Enregistrement impossible pour le moment.' }, 500);

  return json({ ok: true, medias });
};

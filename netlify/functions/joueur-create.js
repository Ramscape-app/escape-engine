import { adminClient, requireAdmin, json, emailJoueur } from './_auth.js';

// Création d'un joueur par l'organisateur, sans code d'invitation.
// Le parcours joueur équivalent est netlify/functions/rejoindre.js ; les deux
// doivent se comporter pareil, notamment sur le retour arrière en cas d'échec.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const { pseudo, password, jeu_id, slug } = body;
  if (!pseudo || !password || !jeu_id || !slug)
    return json({ error: 'pseudo, mot de passe et jeu requis' }, 400);

  const sb = adminClient();
  const email = emailJoueur(pseudo, slug);
  if (!email) return json({ error: 'Pseudo invalide (au moins une lettre ou un chiffre).' }, 400);

  // 1) créer le compte (confirmé d'office)
  const { data: created, error: e1 } = await sb.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (e1) return json({ error: e1.message }, 400);

  // 2) créer le profil joueur — en cas d'échec, supprimer le compte plutôt que
  //    de laisser un orphelin que personne ne peut plus ni réinscrire ni utiliser
  const { error: e2 } = await sb.from('joueurs').insert({
    id: created.user.id, pseudo: pseudo.trim(), jeu_id, actif: true
  });
  if (e2) {
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return json({ error: e2.message }, 500);
  }

  return json({ ok: true });
};

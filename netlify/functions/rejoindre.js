import { adminClient, json, normaliserCode, emailJoueur } from './_auth.js';

// Inscription d'un joueur à partir d'un code d'invitation.
//
// Endpoint public, mais c'est désormais le SEUL chemin de création d'un joueur :
// le navigateur ne lit plus la table `codes` et n'insère plus dans `joueurs`.
// Le jeu rattaché est déduit du code côté serveur, jamais d'un champ envoyé par
// le client — c'est ce qui empêche de s'inscrire sur un jeu sans en avoir le code.
const REFUS = "Code invalide, désactivé ou expiré.";

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const pseudo = String(body.pseudo || '').trim();
  const password = String(body.password || '');
  const code = normaliserCode(body.code);

  // 1) Forme des entrées
  if (!code) return json({ error: "Entre un code d'invitation." }, 400);
  if (pseudo.length < 2) return json({ error: "Choisis un pseudo d'au moins 2 caractères." }, 400);
  if (password.length < 6) return json({ error: 'Le mot de passe doit faire au moins 6 caractères.' }, 400);

  const sb = adminClient();

  // 2) Le code, et le jeu qu'il ouvre
  const { data: c, error: eCode } = await sb.from('codes')
    .select('code, actif, max_joueurs, expire_le, jeu:jeux(id, slug, name, statut)')
    .eq('code', code).maybeSingle();
  if (eCode) return json({ error: 'Inscription impossible pour le moment.' }, 500);
  if (!c || !c.jeu) return json({ error: REFUS }, 404);
  if (c.actif === false) return json({ error: REFUS }, 403);

  // 3) Expiration du code
  if (c.expire_le && new Date(c.expire_le) < new Date()) {
    return json({ error: "Ce code d'invitation a expiré." }, 403);
  }

  // 4) Le moteur ne sait charger qu'un jeu publié : inscrire sur un brouillon
  //    laisserait le joueur bloqué sans explication.
  if (c.jeu.statut !== 'publie') {
    return json({ error: "Ce jeu n'est pas encore ouvert aux joueurs." }, 403);
  }

  // 5) Quota de joueurs pour ce code
  if (c.max_joueurs) {
    const { count, error: eCount } = await sb.from('joueurs')
      .select('*', { count: 'exact', head: true })
      .eq('code_utilise', c.code);
    if (eCount) return json({ error: 'Inscription impossible pour le moment.' }, 500);
    if (count >= c.max_joueurs) {
      return json({ error: 'Ce code a atteint son nombre maximum de joueurs.' }, 403);
    }
  }

  // 6) Adresse technique (le pseudo peut se réduire à rien une fois normalisé)
  const email = emailJoueur(pseudo, c.jeu.slug);
  if (!email) {
    return json({ error: 'Choisis un pseudo contenant au moins une lettre ou un chiffre.' }, 400);
  }

  // 7) Le compte, confirmé d'office (les joueurs n'ont pas d'email réel)
  const { data: created, error: eUser } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (eUser) return json({ error: eUser.message }, 400);

  // 8) Le profil. En cas d'échec on supprime le compte : sans ce retour arrière,
  //    le joueur se retrouvait avec un compte sans profil, incapable de se
  //    réinscrire (« pseudo déjà pris ») comme de jouer.
  const { error: eProfil } = await sb.from('joueurs').insert({
    id: created.user.id, pseudo, jeu_id: c.jeu.id,
    code_utilise: c.code, actif: true,
  });
  if (eProfil) {
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return json({ error: eProfil.message }, 500);
  }

  return json({ ok: true, slug: c.jeu.slug });
};

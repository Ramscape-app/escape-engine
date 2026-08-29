import { adminClient, json, normaliserCode, emailJoueur } from './_auth.js';

// Inscription d'un joueur à partir d'un code d'invitation.
//
// Endpoint public, mais c'est désormais le SEUL chemin de création d'un joueur :
// le navigateur ne lit plus la table `codes` et n'insère plus dans `joueurs`.
// Le jeu rattaché est déduit du code côté serveur, jamais d'un champ envoyé par
// le client — c'est ce qui empêche de s'inscrire sur un jeu sans en avoir le code.
const REFUS = "Code invalide, désactivé ou expiré.";

// Un code d'invitation = une équipe. `equipes.code` est unique, donc la première
// inscription crée l'équipe et les suivantes la retrouvent.
// En cas d'échec on renvoie null plutôt que de refuser l'inscription : mieux vaut
// un joueur en solo qu'un joueur qui ne peut pas entrer.
async function trouverOuCreerEquipe(sb, c) {
  try {
    const { data: existante } = await sb.from('equipes')
      .select('id').eq('code', c.code).maybeSingle();
    if (existante) return existante.id;

    const { data: creee, error } = await sb.from('equipes')
      .insert({ code: c.code, jeu_id: c.jeu.id, nom: c.label || null })
      .select('id').single();
    if (!error && creee) return creee.id;

    // Course entre deux inscriptions simultanées : l'unicité de `code` a joué,
    // l'équipe existe donc désormais.
    const { data: rattrapee } = await sb.from('equipes')
      .select('id').eq('code', c.code).maybeSingle();
    return rattrapee ? rattrapee.id : null;
  } catch (e) {
    return null;
  }
}

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
    .select('code, actif, label, max_joueurs, expire_le, jeu:jeux(id, slug, name, statut)')
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

  // 8) L'équipe : un code = une équipe. La première inscription la crée, les
  //    suivantes la rejoignent. Réservé au serveur — le navigateur n'a aucune
  //    policy d'insertion sur `equipes`.
  const equipeId = await trouverOuCreerEquipe(sb, c);

  // 9) Le profil. En cas d'échec on supprime le compte : sans ce retour arrière,
  //    le joueur se retrouvait avec un compte sans profil, incapable de se
  //    réinscrire (« pseudo déjà pris ») comme de jouer.
  const { error: eProfil } = await sb.from('joueurs').insert({
    id: created.user.id, pseudo, jeu_id: c.jeu.id,
    code_utilise: c.code, actif: true, equipe_id: equipeId,
  });
  if (eProfil) {
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return json({ error: eProfil.message }, 500);
  }

  // 10) Annoncer l'arrivée aux coéquipiers déjà connectés.
  if (equipeId) {
    await sb.from('activite').insert({
      equipe_id: equipeId, joueur_id: created.user.id, pseudo, type: 'arrivee',
    }).then(() => {}, () => {});   // le fil est un confort : son échec ne bloque rien
  }

  return json({ ok: true, slug: c.jeu.slug });
};

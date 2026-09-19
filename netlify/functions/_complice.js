import { randomBytes } from 'node:crypto';

// ── Le jeton d'un complice ────────────────────────────────────────────────
//
// C'est la seule chose qui protege un questionnaire : le complice n'a pas de
// compte, et lui en faire creer un le ferait abandonner avant la premiere
// question. Le lien est donc le secret, et il doit etre impossible a deviner.
//
// 24 octets, soit 192 bits d'entropie en base64url — hors de portee d'une
// enumeration, meme en tapant au hasard pendant des annees.
export function nouveauJeton() {
  return randomBytes(24).toString('base64url');
}

// Tous les echecs de resolution renvoient le meme message, sur le modele de
// `code-resolve` : un lien expire, revoque ou inexistant se ressemblent, sinon
// on apprend a l'attaquant lesquels de ses essais visent juste.
export const REFUS = 'Ce lien n\'est plus valide.';

// Resout un jeton en complice + questionnaire + client.
//
// Ne renvoie JAMAIS la fiche projet du client (budget, contraintes, logistique)
// ni ses coordonnees : le complice prepare une surprise, il n'est pas le client.
// Seul le nom sort d'ici, pour que la page puisse dire pour qui c'est.
export async function resoudreJeton(sb, jeton) {
  const j = String(jeton || '').trim();
  // Un jeton mal forme ne merite pas une requete : on economise l'aller-retour
  // et on ferme la porte aux caracteres exotiques.
  if (!j || j.length < 16 || j.length > 64 || !/^[A-Za-z0-9_-]+$/.test(j)) return null;

  // `clients(id, nom)` enumere ses colonnes a dessein, contre la regle du `*` :
  // un `*` ferait sortir `projet`, `email` et `telephone` vers une page
  // publique. Ici la fuite coute plus cher que le risque de migration, et les
  // deux colonnes retenues sont les dernieres qui disparaitraient.
  const { data, error } = await sb.from('complices')
    .select('*, questionnaire:questionnaires(*, client:clients(id, nom))')
    .eq('jeton', j).maybeSingle();

  if (error || !data || !data.questionnaire) return null;
  return data;
}

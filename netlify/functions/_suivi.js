import { json } from './_auth.js';

// Une équipe et un joueur solo se pilotent pareil : seule change la table qui
// porte la progression. Ce module résout la cible une fois pour toutes, pour que
// les fonctions d'aide n'aient pas à dupliquer le branchement.
//
//   { equipe_id }  → progression dans `parties_equipe`, activité liée à l'équipe
//   { joueur_id }  → progression dans `parties`,        activité liée au joueur
export async function resoudreCible(sb, { equipe_id, joueur_id }) {
  if (equipe_id) {
    const { data, error } = await sb.from('equipes')
      .select('id, nom, code, jeu_id').eq('id', equipe_id).maybeSingle();
    if (error) return { erreur: error.message, status: 500 };
    if (!data) return { erreur: 'Équipe introuvable', status: 404 };
    return {
      type: 'equipe', id: data.id, nom: data.nom || data.code, jeu_id: data.jeu_id,
      table: 'parties_equipe', cle: { equipe_id: data.id },
      activite: { equipe_id: data.id, joueur_cible: null },
    };
  }
  if (joueur_id) {
    const { data, error } = await sb.from('joueurs')
      .select('id, pseudo, jeu_id, equipe_id').eq('id', joueur_id).maybeSingle();
    if (error) return { erreur: error.message, status: 500 };
    if (!data) return { erreur: 'Joueur introuvable', status: 404 };
    // Un joueur rattaché à une équipe s'aide via son équipe : sinon ses
    // coéquipiers ne verraient pas passer l'indice ni le déblocage.
    if (data.equipe_id) return resoudreCible(sb, { equipe_id: data.equipe_id });
    return {
      type: 'solo', id: data.id, nom: data.pseudo, jeu_id: data.jeu_id,
      table: 'parties', cle: { joueur_id: data.id },
      activite: { equipe_id: null, joueur_cible: data.id },
    };
  }
  return { erreur: 'equipe_id ou joueur_id requis', status: 400 };
}

export function refus(c) { return json({ error: c.erreur }, c.status || 500); }

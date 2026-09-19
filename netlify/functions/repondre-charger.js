import { adminClient, json } from './_auth.js';
import { resoudreJeton, REFUS } from './_complice.js';

// Charge le questionnaire d'un complice a partir de son jeton.
//   POST { jeton }
//
// ⚠️ Fonction PUBLIQUE : tout ce qui sort d'ici est lisible par quiconque tient
//    le lien. Le complice prepare une surprise pour le client — il n'est pas le
//    client. Ne sortent donc d'ici que le nom du client, le mot d'accueil, et
//    les questions selectionnees. Ni la fiche projet, ni le budget, ni les
//    coordonnees, ni les reponses des AUTRES complices.
//
// En POST et non en GET : le jeton ne se retrouve ainsi ni dans les journaux
// d'acces, ni dans un en-tete `Referer` en cas de lien sortant.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const sb = adminClient();
  const complice = await resoudreJeton(sb, body.jeton);
  if (!complice) return json({ error: REFUS }, 404);

  const qn = complice.questionnaire;
  const items = Array.isArray(qn.items) ? qn.items : [];

  // Le catalogue, pour les libelles et les types. Une question retiree du
  // catalogue disparait simplement du questionnaire : mieux vaut une question
  // en moins qu'un champ sans intitule.
  const { data: cat } = await sb.from('questions').select('*');
  const parId = {};
  (cat || []).forEach(q => { parId[q.id] = q; });

  const { data: deja } = await sb.from('reponses')
    .select('*').eq('complice_id', complice.id);
  const repondu = {};
  (deja || []).forEach(r => { repondu[r.question_id] = r.valeur; });

  const questions = items.map(it => {
    const q = parId[it.q];
    if (!q || q.actif === false) return null;
    return {
      id: q.id,
      section: q.section,
      // Le libelle personnalise du questionnaire prime : c'est celui qui tutoie
      // le complice et nomme les personnes.
      libelle: it.libelle || q.libelle,
      aide: q.aide || '',
      type: q.type,
      options: q.options || null,
      obligatoire: !!it.obligatoire,
      // Deja repondu > pre-rempli par l'organisateur > vide.
      valeur: repondu[q.id] !== undefined ? repondu[q.id] : (it.valeur || ''),
      // La page a besoin de savoir d'ou vient la valeur affichee : un pre-rempli
      // n'est pas encore une reponse, et devra etre enregistre au moment ou le
      // complice declare avoir tout relu.
      enregistre: repondu[q.id] !== undefined,
    };
  }).filter(Boolean);

  // Premiere ouverture : on la date, pour savoir qui relancer.
  if (!complice.ouvert_le) {
    await sb.from('complices')
      .update({ ouvert_le: new Date().toISOString() }).eq('id', complice.id);
  }

  return json({
    ok: true,
    complice: { nom: complice.nom, relation: complice.relation },
    client: qn.client ? qn.client.nom : '',
    titre: qn.nom,
    mot_accueil: qn.mot_accueil || '',
    termine: !!complice.termine_le,
    questions,
  });
};

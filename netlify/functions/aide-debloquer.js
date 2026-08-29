import { adminClient, requireAdmin, json } from './_auth.js';
import { resoudreCible, refus } from './_suivi.js';

// Débloque en validant une énigme à la place des joueurs.
//   POST { equipe_id | joueur_id, enigme_index }
//
// Le moteur fusionne les `resolues` reçues en Realtime et se recale sur
// `enigme_courante` : écrire dans la table de progression suffit à faire avancer
// les téléphones concernés, sans une ligne de code côté joueur.
//
// Le geste est ensuite tracé dans `activite`, pour que les joueurs sachent que
// l'énigme vient de l'organisateur — la partie n'avance jamais sans qu'on sache
// ce qui s'est passé.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const idx = parseInt(body.enigme_index, 10);
  if (!Number.isInteger(idx) || idx < 0) return json({ error: 'enigme_index invalide' }, 400);

  const sb = adminClient();
  const cible = await resoudreCible(sb, body);
  if (cible.erreur) return refus(cible);

  const filtre = sb.from(cible.table)
    .select('resolues, enigme_courante, indices_utilises')
    .eq('jeu_id', cible.jeu_id);
  Object.entries(cible.cle).forEach(([k, v]) => filtre.eq(k, v));
  const { data: partie, error: eP } = await filtre.maybeSingle();
  if (eP) return json({ error: eP.message }, 500);

  const resolues = Array.isArray(partie && partie.resolues) ? partie.resolues : [];
  if (resolues.includes(idx)) return json({ error: 'Cette énigme est déjà résolue.' }, 409);

  const majResolues = [...resolues, idx].sort((a, b) => a - b);
  const majCourante = Math.max((partie && partie.enigme_courante) || 0, idx + 1);
  const conflit = cible.type === 'equipe' ? 'equipe_id,jeu_id' : 'joueur_id,jeu_id';

  const { error: eMaj } = await sb.from(cible.table).upsert({
    ...cible.cle, jeu_id: cible.jeu_id,
    resolues: majResolues,
    enigme_courante: majCourante,
    indices_utilises: (partie && partie.indices_utilises) || [],
    updated_at: new Date().toISOString(),
  }, { onConflict: conflit });
  if (eMaj) return json({ error: eMaj.message }, 500);

  await sb.from('activite').insert({
    ...cible.activite, joueur_id: null, pseudo: null, type: 'organisateur',
    enigme_index: idx,
    contenu: `énigme ${idx + 1} débloquée par l'organisateur`,
  }).then(() => {}, () => {});   // la trace est un confort, son échec ne défait rien

  return json({ ok: true, cible: cible.nom, resolues: majResolues, enigme_courante: majCourante });
};

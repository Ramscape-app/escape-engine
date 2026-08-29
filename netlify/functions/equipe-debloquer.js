import { adminClient, requireAdmin, json } from './_auth.js';

// Débloque une équipe en validant une énigme à sa place.
//
// Le moteur fusionne déjà les `resolues` reçues en Realtime et se recale sur
// `enigme_courante` : écrire dans `parties_equipe` suffit à faire avancer tous
// les téléphones de l'équipe, sans une ligne de code côté joueur.
//
// Le geste est ensuite tracé dans `activite`, pour que les joueurs sachent que
// l'énigme vient de l'organisateur et non d'un coéquipier — c'est la règle qu'on
// s'est fixée : la partie n'avance jamais sans qu'on sache ce qui s'est passé.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const equipe_id = body.equipe_id;
  const idx = parseInt(body.enigme_index, 10);
  if (!equipe_id) return json({ error: 'equipe_id requis' }, 400);
  if (!Number.isInteger(idx) || idx < 0) return json({ error: 'enigme_index invalide' }, 400);

  const sb = adminClient();

  const { data: equipe, error: eEq } = await sb.from('equipes')
    .select('id, jeu_id, nom').eq('id', equipe_id).maybeSingle();
  if (eEq) return json({ error: eEq.message }, 500);
  if (!equipe) return json({ error: 'Équipe introuvable' }, 404);

  const { data: partie, error: eP } = await sb.from('parties_equipe')
    .select('resolues, enigme_courante, indices_utilises')
    .eq('equipe_id', equipe_id).eq('jeu_id', equipe.jeu_id).maybeSingle();
  if (eP) return json({ error: eP.message }, 500);

  const resolues = Array.isArray(partie && partie.resolues) ? partie.resolues : [];
  if (resolues.includes(idx)) return json({ error: 'Cette énigme est déjà résolue.' }, 409);

  const majResolues = [...resolues, idx].sort((a, b) => a - b);
  const majCourante = Math.max((partie && partie.enigme_courante) || 0, idx + 1);

  const { error: eMaj } = await sb.from('parties_equipe').upsert({
    equipe_id, jeu_id: equipe.jeu_id,
    resolues: majResolues,
    enigme_courante: majCourante,
    indices_utilises: (partie && partie.indices_utilises) || [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'equipe_id,jeu_id' });
  if (eMaj) return json({ error: eMaj.message }, 500);

  await sb.from('activite').insert({
    equipe_id, joueur_id: null, pseudo: null, type: 'organisateur',
    enigme_index: idx,
    contenu: `énigme ${idx + 1} débloquée par l'organisateur`,
  }).then(() => {}, () => {});   // la trace est un confort, son échec ne défait rien

  return json({ ok: true, resolues: majResolues, enigme_courante: majCourante });
};

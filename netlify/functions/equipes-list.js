import { adminClient, requireAdmin, json } from './_auth.js';

// Les équipes et leur état, pour la console de suivi en direct.
//
// Le chiffre utile pendant un événement n'est pas le temps total mais le temps
// passé sur l'énigme en cours : c'est lui qui signale un blocage. On le déduit
// de `parties_equipe.updated_at`, mis à jour à chaque progression.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  const [eqR, partR, jeuxR, joueursR] = await Promise.all([
    sb.from('equipes').select('id, code, jeu_id, nom, created_at').order('created_at', { ascending: false }),
    sb.from('parties_equipe').select('equipe_id, jeu_id, enigme_courante, resolues, termine, updated_at'),
    sb.from('jeux').select('id, name, slug, enigmas'),
    sb.from('joueurs').select('id, pseudo, equipe_id'),
  ]);
  if (eqR.error) return json({ error: eqR.error.message }, 500);

  const parEquipe = {};
  (partR.data || []).forEach(p => { parEquipe[p.equipe_id] = p; });

  const jeuInfo = {};
  (jeuxR.data || []).forEach(j => {
    jeuInfo[j.id] = { name: j.name, slug: j.slug, total: Array.isArray(j.enigmas) ? j.enigmas.length : 0 };
  });

  const membres = {};
  (joueursR.data || []).forEach(j => {
    if (!j.equipe_id) return;
    (membres[j.equipe_id] = membres[j.equipe_id] || []).push(j.pseudo);
  });

  const equipes = (eqR.data || []).map(e => {
    const p = parEquipe[e.id] || null;
    const info = jeuInfo[e.jeu_id] || { name: '?', slug: '', total: 0 };
    return {
      id: e.id,
      nom: e.nom || e.code,
      code: e.code,
      jeu: info.name,
      total_enigmes: info.total,
      membres: membres[e.id] || [],
      commencee: !!p,
      termine: !!(p && p.termine),
      enigme_courante: p ? (p.enigme_courante || 0) : 0,
      resolues: p && Array.isArray(p.resolues) ? p.resolues.length : 0,
      // Dernière progression : la base du « bloqué depuis » calculé côté console.
      derniere_maj: p ? p.updated_at : null,
      created_at: e.created_at,
    };
  });

  return json({ ok: true, equipes });
};

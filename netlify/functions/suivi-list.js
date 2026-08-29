import { adminClient, requireAdmin, json } from './_auth.js';

// Tout ce qui joue en ce moment, équipes ET joueurs seuls, dans une seule liste.
//
// Le chiffre utile pendant un événement n'est pas le temps total mais le temps
// écoulé depuis la dernière progression : c'est lui qui signale un blocage.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  const [eqR, partEqR, partSoloR, jeuxR, joueursR] = await Promise.all([
    sb.from('equipes').select('id, code, jeu_id, nom, created_at').order('created_at', { ascending: false }),
    sb.from('parties_equipe').select('equipe_id, jeu_id, enigme_courante, resolues, termine, updated_at'),
    sb.from('parties').select('joueur_id, jeu_id, enigme_courante, resolues, termine, updated_at'),
    sb.from('jeux').select('id, name, slug, enigmas'),
    sb.from('joueurs').select('id, pseudo, jeu_id, equipe_id, created_at'),
  ]);
  if (eqR.error) return json({ error: eqR.error.message }, 500);

  const jeuInfo = {};
  (jeuxR.data || []).forEach(j => {
    jeuInfo[j.id] = { name: j.name, total: Array.isArray(j.enigmas) ? j.enigmas.length : 0 };
  });
  const parEquipe = {}; (partEqR.data || []).forEach(p => { parEquipe[p.equipe_id] = p; });
  const parJoueur = {}; (partSoloR.data || []).forEach(p => { parJoueur[p.joueur_id] = p; });

  const membres = {};
  (joueursR.data || []).forEach(j => {
    if (j.equipe_id) (membres[j.equipe_id] = membres[j.equipe_id] || []).push(j.pseudo);
  });

  const fiche = (type, id, nom, jeuId, partie, gens, date) => {
    const info = jeuInfo[jeuId] || { name: '?', total: 0 };
    return {
      type, id, nom,
      jeu: info.name, total_enigmes: info.total,
      membres: gens,
      commencee: !!partie,
      termine: !!(partie && partie.termine),
      enigme_courante: partie ? (partie.enigme_courante || 0) : 0,
      resolues: partie && Array.isArray(partie.resolues) ? partie.resolues.length : 0,
      derniere_maj: partie ? partie.updated_at : null,
      created_at: date,
    };
  };

  const equipes = (eqR.data || []).map(e =>
    fiche('equipe', e.id, e.nom || e.code, e.jeu_id, parEquipe[e.id] || null, membres[e.id] || [], e.created_at));

  // Les joueurs sans équipe : c'est tout ce qui existait avant les équipes, et
  // quiconque joue seul. Ils étaient invisibles dans la console jusqu'ici.
  const solos = (joueursR.data || []).filter(j => !j.equipe_id).map(j =>
    fiche('solo', j.id, j.pseudo, j.jeu_id, parJoueur[j.id] || null, [j.pseudo], j.created_at));

  const participants = [...equipes, ...solos].sort((a, b) => {
    const actif = x => (x.commencee && !x.termine) ? 0 : 1;   // les parties en cours d'abord
    return actif(a) - actif(b) || String(b.derniere_maj || b.created_at).localeCompare(String(a.derniere_maj || a.created_at));
  });

  return json({ ok: true, participants });
};

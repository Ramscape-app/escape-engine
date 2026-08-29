import { adminClient, requireAdmin, json } from './_auth.js';

// Reconstitution d'une partie, pour le compte rendu remis au client.
//
//   GET ?equipe_id=<uuid>   une partie jouée en équipe
//   GET ?joueur_id=<uuid>   une partie jouée en solo
//
// Rien n'est calculé à l'avance : tout se déduit des horodatages déjà collectés
// dans `activite` (équipe) ou `evenements` (solo). La logique de temps par acte
// reprend celle de showPlayerHome() côté moteur, pour ne pas en avoir deux.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const url = new URL(req.url);
  const equipeId = url.searchParams.get('equipe_id');
  const joueurId = url.searchParams.get('joueur_id');
  if (!equipeId && !joueurId) return json({ error: 'equipe_id ou joueur_id requis' }, 400);

  const sb = adminClient();
  const d = equipeId
    ? await debriefEquipe(sb, equipeId)
    : await debriefSolo(sb, joueurId);
  if (d.error) return json({ error: d.error }, d.status || 500);
  return json({ ok: true, ...d });
};

// ── Découpage du temps par acte ────────────────────────────────────────────
// Une résolution clôt l'acte auquel appartient l'énigme : la durée d'un acte est
// l'écart entre la fin du précédent et sa dernière résolution.
function tempsParActe(jeu, resolutions, debut) {
  const bornes = Array.isArray(jeu.act_boundaries) ? jeu.act_boundaries : [];
  const actes = Array.isArray(jeu.acts) ? jeu.acts : [];
  if (!bornes.length || !actes.length) return [];

  const acteDe = (idx) => {
    for (let a = 0; a < bornes.length - 1; a++) {
      if (idx >= bornes[a] && idx < bornes[a + 1]) return a;
    }
    return actes.length - 1;
  };

  const dernier = {};
  resolutions.forEach(r => {
    const a = acteDe(r.enigme_index);
    dernier[a] = Math.max(dernier[a] || 0, new Date(r.created_at).getTime());
  });

  let precedent = debut;
  return Object.keys(dernier).map(Number).sort((a, b) => a - b).map(a => {
    const duree = dernier[a] - precedent;
    precedent = dernier[a];
    return { acte: (actes[a] && actes[a].name) || `Acte ${a + 1}`, duree_ms: Math.max(0, duree) };
  });
}

// L'énigme sur laquelle on a le plus séché : le plus grand écart entre deux
// résolutions consécutives. C'est le moment fort à raconter au client.
function plusBloquante(jeu, resolutions, debut) {
  if (!resolutions.length) return null;
  let precedent = debut, pire = null;
  resolutions.forEach(r => {
    const t = new Date(r.created_at).getTime();
    const duree = t - precedent;
    if (!pire || duree > pire.duree_ms) {
      pire = { enigme: r.enigme_index, duree_ms: duree, titre: titreEnigme(jeu, r.enigme_index) };
    }
    precedent = t;
  });
  return pire;
}

function titreEnigme(jeu, idx) {
  const e = Array.isArray(jeu.enigmas) ? jeu.enigmas[idx] : null;
  if (!e) return '';
  return String(e.title || e.question || '').slice(0, 90);
}

async function chargerJeu(sb, jeuId) {
  const { data } = await sb.from('jeux')
    .select('id, name, enigmas, acts, act_boundaries').eq('id', jeuId).maybeSingle();
  return data;
}

function synthese(jeu, debut, fin, resolutions, indices, termine) {
  const total = Array.isArray(jeu.enigmas) ? jeu.enigmas.length : 0;
  return {
    jeu: jeu.name,
    debut: debut ? new Date(debut).toISOString() : null,
    fin: fin ? new Date(fin).toISOString() : null,
    duree_ms: (debut && fin) ? Math.max(0, fin - debut) : 0,
    termine,
    total_enigmes: total,
    resolues: resolutions.length,
    actes: tempsParActe(jeu, resolutions, debut),
    plus_bloquante: plusBloquante(jeu, resolutions, debut),
    indices: indices.map(i => ({ enigme: i.enigme_index, titre: titreEnigme(jeu, i.enigme_index) })),
  };
}

async function debriefEquipe(sb, equipeId) {
  const { data: eq } = await sb.from('equipes')
    .select('id, nom, code, jeu_id').eq('id', equipeId).maybeSingle();
  if (!eq) return { error: 'Équipe introuvable', status: 404 };

  const [jeu, filR, partR, membresR] = await Promise.all([
    chargerJeu(sb, eq.jeu_id),
    sb.from('activite').select('joueur_id, pseudo, type, enigme_index, contenu, reussie, created_at')
      .eq('equipe_id', equipeId).order('created_at', { ascending: true }),
    sb.from('parties_equipe').select('termine').eq('equipe_id', equipeId).maybeSingle(),
    sb.from('joueurs').select('pseudo').eq('equipe_id', equipeId),
  ]);
  if (!jeu) return { error: 'Jeu introuvable', status: 404 };

  const fil = filR.data || [];
  const resolutions = fil.filter(a => a.type === 'resolue' && a.enigme_index != null);
  const indices = fil.filter(a => a.type === 'indice');
  const debut = fil.length ? new Date(fil[0].created_at).getTime() : null;
  const derniere = resolutions.length ? new Date(resolutions[resolutions.length - 1].created_at).getTime() : null;

  return {
    mode: 'equipe',
    nom: eq.nom || eq.code,
    membres: (membresR.data || []).map(m => m.pseudo),
    ...synthese(jeu, debut, derniere, resolutions, indices, !!(partR.data && partR.data.termine)),
    moments: fil.slice(-120),
    propositions_ratees: fil.filter(a => a.type === 'proposition' && a.reussie === false).length,
  };
}

async function debriefSolo(sb, joueurId) {
  const { data: j } = await sb.from('joueurs')
    .select('id, pseudo, jeu_id').eq('id', joueurId).maybeSingle();
  if (!j) return { error: 'Joueur introuvable', status: 404 };

  const [jeu, evR, partR, tentR, filR] = await Promise.all([
    chargerJeu(sb, j.jeu_id),
    sb.from('evenements').select('type, enigme_index, created_at')
      .eq('joueur_id', joueurId).eq('jeu_id', j.jeu_id).order('created_at', { ascending: true }),
    sb.from('parties').select('termine').eq('joueur_id', joueurId).eq('jeu_id', j.jeu_id).maybeSingle(),
    sb.from('tentatives').select('reussie').eq('joueur_id', joueurId).eq('jeu_id', j.jeu_id),
    sb.from('activite').select('joueur_id, pseudo, type, enigme_index, contenu, reussie, created_at')
      .eq('joueur_cible', joueurId).order('created_at', { ascending: true }),
  ]);
  if (!jeu) return { error: 'Jeu introuvable', status: 404 };

  const ev = evR.data || [];
  // Le fil est plus riche que les événements (réponses tentées, messages de
  // l'organisateur), mais il n'existe que depuis l'aide au joueur seul : les
  // parties antérieures retombent sur `evenements`.
  const fil = filR.data || [];
  const resolutions = ev.filter(e => e.type === 'resolue' && e.enigme_index != null);
  const indices = ev.filter(e => e.type === 'indice');
  const debut = ev.length ? new Date(ev[0].created_at).getTime() : null;
  const fin = ev.find(e => e.type === 'fin');
  const derniere = fin ? new Date(fin.created_at).getTime()
    : (resolutions.length ? new Date(resolutions[resolutions.length - 1].created_at).getTime() : null);

  return {
    mode: 'solo',
    nom: j.pseudo,
    membres: [j.pseudo],
    ...synthese(jeu, debut, derniere, resolutions, indices, !!(partR.data && partR.data.termine)),
    moments: (fil.length ? fil : ev.map(e => ({ ...e, pseudo: j.pseudo }))).slice(-120),
    propositions_ratees: (tentR.data || []).filter(t => !t.reussie).length,
  };
}

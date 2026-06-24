import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  const [jeuxR, joueursR, partiesR, tentR, themesR, evR] = await Promise.all([
    sb.from('jeux').select('id, name, slug, statut, enigmas, theme_id'),
    sb.from('joueurs').select('id, jeu_id, actif, created_at'),
    sb.from('parties').select('joueur_id, jeu_id, enigme_courante, termine, updated_at'),
    sb.from('tentatives').select('jeu_id, enigme_index, reussie'),
    sb.from('themes').select('id, name'),
    sb.from('evenements').select('jeu_id, type, created_at'),
  ]);
  if (jeuxR.error) return json({ error: jeuxR.error.message }, 500);

  const jeux = jeuxR.data || [], joueurs = joueursR.data || [], parties = partiesR.data || [];
  const tentatives = tentR.data || [], themes = themesR.data || [], evenements = evR.data || [];
  const themeName = Object.fromEntries(themes.map(t => [t.id, t.name]));
  const now = Date.now(), j7 = now - 7*864e5, j30 = now - 30*864e5;

  // ── Chiffres clés globaux ──
  const global = {
    jeux_total: jeux.length,
    jeux_publies: jeux.filter(j => j.statut === 'publie').length,
    jeux_brouillons: jeux.filter(j => j.statut === 'brouillon').length,
    joueurs_total: joueurs.length,
    joueurs_actifs: joueurs.filter(j => j.actif !== false).length,
    joueurs_inactifs: joueurs.filter(j => j.actif === false).length,
    parties_en_cours: parties.filter(p => !p.termine).length,
    parties_terminees: parties.filter(p => p.termine).length,
    themes_total: themes.length,
    completion_moyenne: parties.length ? Math.round(100 * parties.filter(p=>p.termine).length / parties.length) : 0,
  };

  // ── Engagement / activité récente ──
  const engagement = {
    inscrits_7j: joueurs.filter(j => new Date(j.created_at).getTime() >= j7).length,
    inscrits_30j: joueurs.filter(j => new Date(j.created_at).getTime() >= j30).length,
    parties_actives_7j: parties.filter(p => p.updated_at && new Date(p.updated_at).getTime() >= j7).length,
    fins_30j: evenements.filter(e => e.type === 'fin' && new Date(e.created_at).getTime() >= j30).length,
  };

  // ── Détail par jeu enrichi ──
  const overview = jeux.map(j => {
    const totalEnig = Array.isArray(j.enigmas) ? j.enigmas.length : 0;
    const js = joueurs.filter(x => x.jeu_id === j.id);
    const ps = parties.filter(x => x.jeu_id === j.id);
    const finis = ps.filter(x => x.termine).length;
    const enCours = ps.filter(x => !x.termine).length;
    const enigMoy = ps.length ? Math.round(ps.reduce((s,p)=>s+(p.enigme_courante||0),0) / ps.length) : 0;
    return {
      jeu: j.name, slug: j.slug, statut: j.statut,
      theme: themeName[j.theme_id] || '—',
      joueurs: js.length,
      actifs: js.filter(x => x.actif !== false).length,
      en_cours: enCours, ont_fini: finis,
      taux_fin: js.length ? Math.round(100 * finis / js.length) : 0,
      enigme_moyenne: enigMoy, total_enigmes: totalEnig,
    };
  }).sort((a,b)=>b.joueurs - a.joueurs);

  // ── Difficulté / blocages enrichis (taux d'échec par énigme) ──
  const jeuName = Object.fromEntries(jeux.map(j => [j.id, j.name]));
  const blocMap = {};
  tentatives.forEach(t => {
    const key = t.jeu_id + '#' + t.enigme_index;
    if (!blocMap[key]) blocMap[key] = { jeu: jeuName[t.jeu_id] || '?', enigme: t.enigme_index, echecs: 0, reussites: 0 };
    if (t.reussie) blocMap[key].reussites++; else blocMap[key].echecs++;
  });
  const blocages = Object.values(blocMap).map(b => ({
    ...b, total: b.echecs + b.reussites,
    taux_echec: (b.echecs + b.reussites) ? Math.round(100 * b.echecs / (b.echecs + b.reussites)) : 0,
  })).filter(b => b.echecs > 0).sort((a,b) => b.echecs - a.echecs).slice(0, 15);

  // ── Thèmes : utilisation ──
  const themeUsage = themes.map(t => ({
    nom: t.name,
    jeux: jeux.filter(j => j.theme_id === t.id).map(j => j.name),
  })).sort((a,b) => b.jeux.length - a.jeux.length);

  return json({ ok: true, global, engagement, overview, blocages, themeUsage });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

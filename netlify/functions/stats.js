import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  // `tentatives` et `evenements` grossissent à chaque geste de jeu : les charger
  // en entier finissait par tronquer silencieusement les résultats (constat R-03).
  // Elles sont désormais agrégées en SQL. Les autres tables croissent avec le
  // nombre de clients, pas avec l'activité : elles restent chargées telles quelles.
  const [jeuxR, joueursR, partiesR, partiesEqR, tentR, themesR, evR, mauvaisesR] = await Promise.all([
    sb.from('jeux').select('id, name, slug, statut, enigmas, theme_id'),
    sb.from('joueurs').select('id, jeu_id, actif, created_at'),
    sb.from('parties').select('joueur_id, jeu_id, enigme_courante, termine, updated_at'),
    sb.from('parties_equipe').select('equipe_id, jeu_id, enigme_courante, termine, updated_at'),
    sb.rpc('stats_tentatives'),
    sb.from('themes').select('*'),
    sb.rpc('stats_evenements'),
    sb.rpc('stats_mauvaises_reponses', { p_limite: 120 }),
  ]);
  if (jeuxR.error) return json({ error: jeuxR.error.message }, 500);

  const jeux = jeuxR.data || [], joueurs = joueursR.data || [];
  // Les parties d'équipe comptent comme des parties : sans elles, une soirée
  // entière jouée en équipe n'apparaîtrait nulle part dans les chiffres.
  const parties = [...(partiesR.data || []), ...(partiesEqR.data || [])];
  const tentatives = tentR.data || [], themes = themesR.data || [];
  const evStats = (evR.data && evR.data[0]) || { fins_30j: 0, debuts_30j: 0 };
  const mauvaises = mauvaisesR.data || [];
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
    fins_30j: Number(evStats.fins_30j) || 0,
    debuts_30j: Number(evStats.debuts_30j) || 0,
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
      // Rapporté aux parties et non aux joueurs : en équipe, une seule partie
      // couvre plusieurs joueurs, et le taux serait mécaniquement sous-estimé.
      taux_fin: ps.length ? Math.round(100 * finis / ps.length) : 0,
      enigme_moyenne: enigMoy, total_enigmes: totalEnig,
    };
  }).sort((a,b)=>b.joueurs - a.joueurs);

  // ── Difficulté / blocages enrichis (taux d'échec par énigme) ──
  const jeuName = Object.fromEntries(jeux.map(j => [j.id, j.name]));
  // Le titre de l'énigme rend le diagnostic lisible sans rouvrir l'éditeur.
  const titreEnigme = (jeuId, idx) => {
    const j = jeux.find(x => x.id === jeuId);
    const e = j && Array.isArray(j.enigmas) ? j.enigmas[idx] : null;
    return (e && (e.title || e.question)) ? String(e.title || e.question).slice(0, 70) : '';
  };

  const blocages = tentatives.map(t => {
    const echecs = Number(t.echecs) || 0, reussites = Number(t.reussites) || 0;
    return {
      jeu: jeuName[t.jeu_id] || '?', enigme: t.enigme_index,
      titre: titreEnigme(t.jeu_id, t.enigme_index),
      echecs, reussites, total: echecs + reussites,
      taux_echec: (echecs + reussites) ? Math.round(100 * echecs / (echecs + reussites)) : 0,
    };
  }).filter(b => b.echecs > 0).sort((a,b) => b.echecs - a.echecs).slice(0, 15);

  // ── Ce que les joueurs répondent quand ils se trompent ──
  // Collecté depuis toujours dans tentatives.reponse, affiché nulle part.
  const mauvaisesReponses = mauvaises.map(m => ({
    jeu: jeuName[m.jeu_id] || '?', enigme: m.enigme_index,
    titre: titreEnigme(m.jeu_id, m.enigme_index),
    reponse: m.reponse, occurrences: Number(m.occurrences) || 0,
  })).filter(m => m.occurrences > 1).slice(0, 40);

  // ── Thèmes : utilisation ──
  const themeUsage = themes.map(t => ({
    nom: t.name,
    jeux: jeux.filter(j => j.theme_id === t.id).map(j => j.name),
  })).sort((a,b) => b.jeux.length - a.jeux.length);

  return json({ ok: true, global, engagement, overview, blocages, mauvaisesReponses, themeUsage });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

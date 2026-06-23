import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  // Récupère en parallèle : jeux, joueurs, parties, tentatives
  const [jeuxR, joueursR, partiesR, tentR] = await Promise.all([
    sb.from('jeux').select('id, name, slug, enigmas'),
    sb.from('joueurs').select('id, jeu_id, actif'),
    sb.from('parties').select('joueur_id, jeu_id, enigme_courante, termine'),
    sb.from('tentatives').select('jeu_id, enigme_index, reussie'),
  ]);
  if (jeuxR.error) return json({ error: jeuxR.error.message }, 500);

  const jeux = jeuxR.data || [];
  const joueurs = joueursR.data || [];
  const parties = partiesR.data || [];
  const tentatives = tentR.data || [];

  // Vue d'ensemble par jeu
  const overview = jeux.map(j => {
    const totalEnig = Array.isArray(j.enigmas) ? j.enigmas.length : 0;
    const js = joueurs.filter(x => x.jeu_id === j.id);
    const ps = parties.filter(x => x.jeu_id === j.id);
    const finis = ps.filter(x => x.termine).length;
    const nb = js.length;
    return {
      jeu: j.name, slug: j.slug,
      joueurs: nb,
      actifs: js.filter(x => x.actif !== false).length,
      ont_fini: finis,
      taux_fin: nb ? Math.round(100 * finis / nb) : 0,
      total_enigmes: totalEnig,
    };
  }).sort((a,b)=>b.joueurs - a.joueurs);

  // Blocages : top énigmes les plus ratées (tous jeux), avec nom du jeu
  const jeuName = Object.fromEntries(jeux.map(j => [j.id, j.name]));
  const blocMap = {};
  tentatives.forEach(t => {
    const key = t.jeu_id + '#' + t.enigme_index;
    if (!blocMap[key]) blocMap[key] = { jeu: jeuName[t.jeu_id] || '?', enigme: t.enigme_index, echecs: 0, reussites: 0 };
    if (t.reussie) blocMap[key].reussites++; else blocMap[key].echecs++;
  });
  const blocages = Object.values(blocMap)
    .filter(b => b.echecs > 0)
    .sort((a,b) => b.echecs - a.echecs)
    .slice(0, 15);

  return json({ ok: true, overview, blocages });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

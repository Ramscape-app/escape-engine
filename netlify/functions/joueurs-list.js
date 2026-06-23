import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  // 1) les joueurs + le nom du jeu (relation directe joueurs → jeux, celle-là existe)
  const { data: joueurs, error } = await sb
    .from('joueurs')
    .select('id, pseudo, created_at, jeu_id, jeu:jeux(name, slug)')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);

  // 2) toutes les parties, qu'on rattache ensuite côté code
  const { data: parties } = await sb
    .from('parties')
    .select('joueur_id, enigme_courante, termine, updated_at');
  const parMap = {};
  (parties || []).forEach(p => { parMap[p.joueur_id] = p; });

  // 3) on fusionne
  const enrichis = (joueurs || []).map(j => ({ ...j, partie: parMap[j.id] || null }));

  return json({ ok: true, joueurs: enrichis });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

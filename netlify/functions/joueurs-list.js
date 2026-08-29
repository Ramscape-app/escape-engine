import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();

  // 1) les joueurs + le nom du jeu (relation directe joueurs → jeux, celle-là existe)
  const { data: joueurs, error } = await sb
    .from('joueurs')
    .select('id, pseudo, created_at, actif, jeu_id, equipe_id, jeu:jeux(name, slug), equipe:equipes(nom, code)')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);

  // 2) les parties solo et les parties d'équipe : un joueur rattaché à une équipe
  //    n'a pas de ligne dans `parties`, sa progression vit dans `parties_equipe`.
  //    Sans ce second appel, toute une équipe en cours s'afficherait « pas commencé ».
  const [soloR, equipeR] = await Promise.all([
    sb.from('parties').select('joueur_id, enigme_courante, termine, updated_at'),
    sb.from('parties_equipe').select('equipe_id, enigme_courante, termine, updated_at'),
  ]);
  const parJoueur = {};
  (soloR.data || []).forEach(p => { parJoueur[p.joueur_id] = p; });
  const parEquipe = {};
  (equipeR.data || []).forEach(p => { parEquipe[p.equipe_id] = p; });

  // 3) on fusionne, l'équipe primant quand elle existe
  const enrichis = (joueurs || []).map(j => ({
    ...j,
    partie: (j.equipe_id ? parEquipe[j.equipe_id] : null) || parJoueur[j.id] || null,
  }));

  return json({ ok: true, joueurs: enrichis });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

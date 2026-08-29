import { adminClient, requireAdmin, json } from './_auth.js';

// Le fil d'activité d'une équipe ou d'un joueur seul.
//   GET ?equipe_id=<uuid>   |   GET ?joueur_id=<uuid>
//
// Le direct passe par Realtime ; cet appel sert au chargement initial.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const p = new URL(req.url).searchParams;
  const equipeId = p.get('equipe_id'), joueurId = p.get('joueur_id');
  if (!equipeId && !joueurId) return json({ error: 'equipe_id ou joueur_id requis' }, 400);

  const sb = adminClient();
  const q = sb.from('activite')
    .select('id, joueur_id, pseudo, type, enigme_index, contenu, reussie, created_at')
    .order('created_at', { ascending: false }).limit(100);
  const { data, error } = await (equipeId
    ? q.eq('equipe_id', equipeId)
    : q.eq('joueur_cible', joueurId));
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, fil: data || [] });
};

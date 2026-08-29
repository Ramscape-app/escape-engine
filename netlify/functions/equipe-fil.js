import { adminClient, requireAdmin, json } from './_auth.js';

// Le fil d'activité d'une équipe, pour la console.
// Le direct passe par Realtime (policies de migration-03) ; cet appel sert au
// chargement initial et au repli si l'abonnement n'est pas disponible.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const equipe_id = new URL(req.url).searchParams.get('equipe_id');
  if (!equipe_id) return json({ error: 'equipe_id requis' }, 400);

  const sb = adminClient();
  const { data, error } = await sb.from('activite')
    .select('id, joueur_id, pseudo, type, enigme_index, contenu, reussie, created_at')
    .eq('equipe_id', equipe_id)
    .order('created_at', { ascending: false }).limit(100);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, fil: data || [] });
};

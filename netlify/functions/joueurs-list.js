import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  // Joueurs + nom du jeu + progression
  const { data, error } = await sb
    .from('joueurs')
    .select('id, pseudo, created_at, jeu:jeux(name, slug), partie:parties(enigme_courante, termine, updated_at)')
    .order('created_at', { ascending: false });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, joueurs: data });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

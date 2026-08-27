import { adminClient, requireAdmin } from './_auth.js';

// Diagnostic réservé aux administrateurs.
// Auparavant ouvert à tous alors qu'il utilise la clé de service.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  const { count, error } = await sb
    .from('joueurs')
    .select('*', { count: 'exact', head: true });

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, total_joueurs: count });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

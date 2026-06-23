import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id, actif } = await req.json();    // id du joueur + nouvel état (true/false)
  if (!id || typeof actif !== 'boolean') return json({ error: 'paramètres manquants' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('joueurs').update({ actif }).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

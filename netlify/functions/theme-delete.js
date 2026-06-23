import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id } = await req.json();
  if (!id) return json({ error: 'id requis' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('themes').delete().eq('id', id);
  if (error) return json({ error: 'Suppression impossible (theme utilise par un jeu ?) : ' + error.message }, 500);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

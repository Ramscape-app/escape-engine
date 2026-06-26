import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  const { data, error } = await sb.from('bibliotheque_enigmes')
    .select('id, titre, categorie, tags, enigme, created_at')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, items: data });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

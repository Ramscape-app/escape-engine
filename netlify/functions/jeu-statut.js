import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id, statut } = await req.json();
  if (!id || !['brouillon', 'publie', 'archive'].includes(statut))
    return json({ error: 'paramètres invalides' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('jeux').update({ statut }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

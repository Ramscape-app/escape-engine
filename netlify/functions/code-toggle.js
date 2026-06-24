import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { code, actif, supprimer } = await req.json();
  if (!code) return json({ error: 'code requis' }, 400);

  const sb = adminClient();
  if (supprimer) {
    const { error } = await sb.from('codes').delete().eq('code', code);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, supprime: true });
  }
  const { error } = await sb.from('codes').update({ actif: !!actif }).eq('code', code);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const t = await req.json();
  if (!t.id || !t.name) return json({ error: 'id et nom requis' }, 400);

  const sb = adminClient();
  const { error } = await sb.from('themes').upsert({
    id: t.id, name: t.name, colors: t.colors || {}, fonts: t.fonts || {},
    radius: (t.radius ?? 12), glow: !!t.glow, updated_at: new Date().toISOString()
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

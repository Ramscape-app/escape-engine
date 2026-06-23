import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { uuid, config } = await req.json();
  if (!uuid || !config) return json({ error: 'uuid et config requis' }, 400);

  const m = config.meta || {};
  const patch = {
    name: m.name || 'Sans titre',
    client: m.client || '',
    note: m.note || '',
    version: m.version || 1,
    theme_id: config.theme || null,
    branding: config.branding || {},
    enigmas: config.enigmas || [],
    acts: config.acts || [],
    act_boundaries: config.actBoundaries || [],
    updated_at: new Date().toISOString()
  };
  const sb = adminClient();
  const { error } = await sb.from('jeux').update(patch).eq('id', uuid);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

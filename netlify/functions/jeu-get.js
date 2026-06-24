import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id manquant' }, 400);

  const sb = adminClient();
  const { data, error } = await sb.from('jeux')
    .select('id, slug, name, client, note, version, theme_id, branding, enigmas, acts, act_boundaries, intro, statut')
    .eq('id', id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'jeu introuvable' }, 404);

  // Reconstruit la forme attendue par l'éditeur (config.json)
  const config = {
    schemaVersion: 1,
    meta: { id: data.slug, name: data.name, client: data.client || '', note: data.note || '', version: data.version || 1 },
    branding: data.branding || {},
    acts: data.acts || [],
    actBoundaries: data.act_boundaries || [],
    enigmas: data.enigmas || [],
    theme: data.theme_id || '',
    intro: data.intro || {}
  };
  return json({ ok: true, uuid: data.id, statut: data.statut, config });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

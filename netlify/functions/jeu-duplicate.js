import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id, name, slug } = await req.json();
  if (!id) return json({ error: 'id du jeu source requis' }, 400);

  const sb = adminClient();
  const { data: src, error: e1 } = await sb.from('jeux').select('*').eq('id', id).maybeSingle();
  if (e1 || !src) return json({ error: 'jeu source introuvable' }, 404);

  const newName = (name || (src.name + ' (copie)')).trim();
  let newSlug = (slug || (src.slug + '-copie')).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  // unicité du slug
  const { data: exist } = await sb.from('jeux').select('id').eq('slug', newSlug).maybeSingle();
  if (exist) newSlug = newSlug + '-' + Date.now().toString().slice(-4);

  const { data, error } = await sb.from('jeux').insert({
    slug: newSlug, name: newName, client: src.client, note: src.note,
    version: src.version || 1, theme_id: src.theme_id,
    branding: src.branding || {}, enigmas: src.enigmas || [],
    acts: src.acts || [], act_boundaries: src.act_boundaries || [],
    statut: 'brouillon',
  }).select('id').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, uuid: data.id, slug: newSlug });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

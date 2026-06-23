import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  let { name, slug } = await req.json();
  name = (name || '').trim();
  slug = (slug || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // retire les accents
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); // propre
  if (!name || !slug) return json({ error: 'Nom et slug requis' }, 400);

  const sb = adminClient();
  // Unicité du slug
  const { data: exist } = await sb.from('jeux').select('id').eq('slug', slug).maybeSingle();
  if (exist) return json({ error: 'Ce slug est déjà utilisé. Choisis-en un autre.' }, 409);

  // Jeu vierge (brouillon)
  const { data, error } = await sb.from('jeux').insert({
    slug, name, statut: 'brouillon',
    enigmas: [], acts: [], act_boundaries: [], branding: {}, version: 1
  }).select('id').single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, uuid: data.id, slug });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

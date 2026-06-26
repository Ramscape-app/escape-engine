import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id, titre, categorie, tags, enigme } = await req.json();
  if (!enigme) return json({ error: 'enigme requise' }, 400);

  const sb = adminClient();
  const row = {
    titre: (titre || enigme.title || 'Sans titre').trim(),
    categorie: categorie || 'autre',
    tags: Array.isArray(tags) ? tags : [],
    enigme,
  };

  if (id) {
    const { error } = await sb.from('bibliotheque_enigmes').update(row).eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id });
  } else {
    const { data, error } = await sb.from('bibliotheque_enigmes').insert(row).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id });
  }
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

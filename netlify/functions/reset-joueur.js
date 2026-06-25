import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id } = await req.json();   // id du joueur
  if (!id) return json({ error: 'id joueur requis' }, 400);

  const sb = adminClient();
  // Efface progression + tentatives + événements (le compte est conservé)
  await sb.from('parties').delete().eq('joueur_id', id);
  await sb.from('tentatives').delete().eq('joueur_id', id);
  await sb.from('evenements').delete().eq('joueur_id', id);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

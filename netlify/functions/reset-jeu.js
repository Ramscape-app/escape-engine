import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { jeu_id } = await req.json();
  if (!jeu_id) return json({ error: 'jeu_id requis' }, 400);

  const sb = adminClient();
  // Tout efface pour ce jeu (comptes conservés)
  await sb.from('parties').delete().eq('jeu_id', jeu_id);
  await sb.from('tentatives').delete().eq('jeu_id', jeu_id);
  await sb.from('evenements').delete().eq('jeu_id', jeu_id);
  return json({ ok: true });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

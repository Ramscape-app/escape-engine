import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  let { code, jeu_id, label, max_joueurs, expire_le } = await req.json();
  if (!jeu_id) return json({ error: 'jeu requis' }, 400);

  code = (code || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  if (!code) {
    // génère un code lisible si non fourni
    const c='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let g='';
    for(let i=0;i<8;i++){ g+=c[Math.floor(Math.random()*c.length)]; if(i===3) g+='-'; }
    code = g;
  }

  const sb = adminClient();
  const { error } = await sb.from('codes').insert({
    code, jeu_id, label: label || null, actif: true,
    max_joueurs: max_joueurs ? parseInt(max_joueurs) : null,
    expire_le: expire_le || null,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, code });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  const { data, error } = await sb.from('codes')
    // `statut` du jeu : un code ne resout que si le jeu est publie
    // (voir code-resolve.js). Sans cette colonne, la console affiche un lien
    // d'invitation parfaitement valide pour un jeu que le joueur ne peut pas
    // ouvrir — et c'est le joueur qui decouvre « Code invalide ».
    .select('code, jeu_id, label, actif, max_joueurs, expire_le, created_at, jeu:jeux(name, slug, statut)')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, codes: data });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

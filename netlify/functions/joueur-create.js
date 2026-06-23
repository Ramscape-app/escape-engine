import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { pseudo, password, jeu_id, slug } = await req.json();
  if (!pseudo || !password || !jeu_id || !slug)
    return json({ error: 'pseudo, mot de passe et jeu requis' }, 400);

  const sb = adminClient();
  // Email technique (même logique que l'inscription joueur)
  const clean = pseudo.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const email = `${clean}@${slug}.joueurs.local`;

  // 1) créer le compte (confirmé d'office)
  const { data: created, error: e1 } = await sb.auth.admin.createUser({
    email, password, email_confirm: true
  });
  if (e1) return json({ error: e1.message }, 400);

  // 2) créer le profil joueur
  const { error: e2 } = await sb.from('joueurs').insert({
    id: created.user.id, pseudo: pseudo.trim(), jeu_id, actif: true
  });
  if (e2) return json({ error: e2.message }, 500);

  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

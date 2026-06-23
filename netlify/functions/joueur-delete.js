import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id } = await req.json();           // id du joueur à supprimer
  if (!id) return json({ error: 'id manquant' }, 400);

  const sb = adminClient();
  // Supprime le compte auth → grâce au "on delete cascade", son profil,
  // sa progression, ses tentatives et événements partent automatiquement avec.
  const { error } = await sb.auth.admin.deleteUser(id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

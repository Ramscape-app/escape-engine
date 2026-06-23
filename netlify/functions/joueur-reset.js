import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const { id, password } = await req.json();
  if (!id || !password) return json({ error: 'id et mot de passe requis' }, 400);

  const sb = adminClient();
  const { error } = await sb.auth.admin.updateUserById(id, { password });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

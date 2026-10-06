import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  // `statut` fait partie de la liste : sans lui, la console lisait `undefined`
  // et affichait « Brouillon » pour TOUS les jeux, publies compris. Publier
  // fonctionnait, mais la pastille ne bougeait jamais — on croyait que le
  // bouton ne faisait rien.
  const { data, error } = await sb.from('jeux').select('id, slug, name, statut').order('name');
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, jeux: data });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

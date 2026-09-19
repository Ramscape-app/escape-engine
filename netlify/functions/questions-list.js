import { adminClient, requireAdmin, json } from './_auth.js';

// Le catalogue de questions, groupe par section.
// Meme motif que la bibliotheque d'enigmes : global, enrichissable, reutilise
// d'un client a l'autre.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  const { data, error } = await sb.from('questions')
    .select('*').order('section').order('ordre');
  if (error) return json({
    error: `${error.message} — la migration 07 a-t-elle ete jouee ?`,
  }, 500);
  return json({ ok: true, questions: data || [] });
};

import { adminClient, requireAdmin } from './_auth.js';

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id manquant' }, 400);

  const sb = adminClient();
  // `select('*')` et non la liste des colonnes : `jeux` s'est étendue à chaque
  // migration (`reglages`, `client_id`…) et PostgREST rejette la requête
  // entière dès qu'une colonne demandée manque. C'est ce qui avait fait
  // basculer un jeu sur le thème par défaut.
  const { data, error } = await sb.from('jeux').select('*').eq('id', id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'jeu introuvable' }, 404);

  // Reconstruit la forme attendue par l'éditeur (config.json)
  const config = {
    schemaVersion: 1,
    meta: { id: data.slug, name: data.name, client: data.client || '', note: data.note || '', version: data.version || 1 },
    branding: data.branding || {},
    acts: data.acts || [],
    actBoundaries: data.act_boundaries || [],
    enigmas: data.enigmas || [],
    theme: data.theme_id || '',
    intro: data.intro || {},
    reglages: data.reglages || {}
  };
  // `client_id` reste hors de `config` : ce n'est pas du contenu de jeu, ça ne
  // part pas dans le config.json exporté. L'éditeur s'en sert pour aller
  // chercher la matière collectée chez les complices de ce client.
  return json({ ok: true, uuid: data.id, statut: data.statut, client_id: data.client_id || null, config });
};
function json(o, s = 200){ return new Response(JSON.stringify(o), { status:s, headers:{'Content-Type':'application/json'} }); }

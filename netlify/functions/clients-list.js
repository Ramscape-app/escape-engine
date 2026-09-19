import { adminClient, requireAdmin, json } from './_auth.js';

// Les clients, avec leurs jeux rattaches.
//
// Un client peut revenir : la liste sert d'historique commercial autant que de
// point d'entree vers la preparation d'un nouvel evenement.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  const sb = adminClient();
  // `select('*')` et non la liste des colonnes : PostgREST rejette la requete
  // entiere des qu'une colonne demandee manque. `client_id` n'existe qu'apres
  // la migration 07, et une base pas encore migree ferait tout tomber.
  const [cliR, jeuxR] = await Promise.all([
    sb.from('clients').select('*').order('created_at', { ascending: false }),
    sb.from('jeux').select('*'),
  ]);
  if (cliR.error) return json({
    error: `${cliR.error.message} — la migration 07 a-t-elle ete jouee ?`,
  }, 500);

  const parClient = {};
  (jeuxR.data || []).forEach(j => {
    if (!j.client_id) return;
    (parClient[j.client_id] = parClient[j.client_id] || []).push(
      { id: j.id, name: j.name, slug: j.slug, statut: j.statut });
  });

  const clients = (cliR.data || []).map(c => ({ ...c, jeux: parClient[c.id] || [] }));

  // Les jeux d'avant l'arrivee des fiches clients : ils portent encore un nom de
  // client en texte libre. On les remonte pour pouvoir les rattacher.
  const orphelins = (jeuxR.data || [])
    .filter(j => !j.client_id)
    .map(j => ({ id: j.id, name: j.name, slug: j.slug, client: j.client || '' }));

  return json({ ok: true, clients, orphelins });
};

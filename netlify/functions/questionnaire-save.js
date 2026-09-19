import { adminClient, requireAdmin, json } from './_auth.js';

// Creation ou mise a jour d'un questionnaire.
//   POST { id?, client_id, nom, mot_accueil, items:[{q, libelle?, valeur?, obligatoire?}] }
//
// `items` est nettoye ici plutot que fait confiance : c'est ce tableau qui
// decide, cote page publique, quelles questions un complice a le droit de
// renseigner. Une cle inattendue qui passerait jusqu'en base finirait par etre
// relue comme une consigne.
const MAX_ITEMS = 200;

export function nettoyerItems(brut) {
  if (!Array.isArray(brut)) return [];
  const vus = new Set();
  const out = [];
  for (const it of brut.slice(0, MAX_ITEMS)) {
    const q = String((it && it.q) || '').trim();
    // Meme forme que les slugs generes par question-save.
    if (!q || !/^[a-z0-9_]+$/.test(q) || vus.has(q)) continue;
    vus.add(q);
    const item = { q };
    const lib = String((it && it.libelle) || '').trim();
    const val = String((it && it.valeur) || '').trim();
    if (lib) item.libelle = lib.slice(0, 400);
    if (val) item.valeur = val.slice(0, 2000);
    if (it && it.obligatoire) item.obligatoire = true;
    out.push(item);
  }
  return out;
}

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const ligne = {
    nom: String(body.nom || '').trim() || 'Questionnaire',
    mot_accueil: String(body.mot_accueil || '').trim() || null,
    items: nettoyerItems(body.items),
    updated_at: new Date().toISOString(),
  };

  const sb = adminClient();
  if (body.id) {
    const { error } = await sb.from('questionnaires').update(ligne).eq('id', body.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: body.id, items: ligne.items.length });
  }

  if (!body.client_id) return json({ error: 'client_id requis' }, 400);
  const { data, error } = await sb.from('questionnaires')
    .insert({ ...ligne, client_id: body.client_id }).select('id').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: data.id, items: ligne.items.length });
};

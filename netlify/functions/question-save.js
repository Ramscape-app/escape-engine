import { adminClient, requireAdmin, json } from './_auth.js';

const TYPES = ['texte', 'texte_long', 'nombre', 'date', 'liste', 'choix', 'media'];
const INGREDIENTS = ['chiffre', 'mot', 'lieu', 'media', 'liste', 'recit'];

// Creation ou mise a jour d'une question du catalogue.
//
// `ingredient` dit ce que la reponse produira comme matiere d'enigme. C'est lui
// qui permettra a l'editeur de proposer « voici les chiffres disponibles pour ce
// client » au moment de poser un cadenas — sans quoi on n'a qu'un formulaire.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const libelle = String(body.libelle || '').trim();
  const section = String(body.section || '').trim().toLowerCase();
  if (!libelle) return json({ error: 'Le libellé est requis.' }, 400);
  if (!section) return json({ error: 'La section est requise.' }, 400);
  if (body.type && !TYPES.includes(body.type)) return json({ error: 'Type inconnu.' }, 400);
  if (body.ingredient && !INGREDIENTS.includes(body.ingredient))
    return json({ error: 'Ingrédient inconnu.' }, 400);

  // Slug lisible, derive du libelle a la creation puis fige : il sert de cle
  // aux reponses, le changer orphelinerait celles deja collectees.
  const slug = String(body.id || libelle).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  if (!slug) return json({ error: 'Libellé inutilisable comme identifiant.' }, 400);

  const ligne = {
    id: slug, section, libelle,
    aide: String(body.aide || '').trim() || null,
    type: body.type || 'texte',
    ingredient: body.ingredient || 'recit',
    options: Array.isArray(body.options) ? body.options : [],
    ordre: parseInt(body.ordre, 10) || 0,
    actif: body.actif !== false,
  };

  const sb = adminClient();
  const { error } = await sb.from('questions').upsert(ligne, { onConflict: 'id' });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: slug });
};

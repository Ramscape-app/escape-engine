import { adminClient, requireAdmin, json } from './_auth.js';

// Importe des enigmes dans la bibliotheque, en une fois.
//   POST { enigmes: [{ titre, categorie, enigme }] }
//
// La bibliotheque ne contenait que ce qu'on y avait sauve a la main, une
// enigme a la fois. Les quarante enigmes du modele « PROJET 1986 » vivaient a
// cote, dans un fichier de configuration, sans qu'aucun chemin ne les relie :
// on ne pouvait pas piocher « Signal Localisé » pour un nouveau jeu sans
// charger le modele entier.
//
// En une fois et non quarante appels : un aller-retour par enigme rendrait
// l'import interruptible au milieu, avec une bibliotheque a moitie remplie et
// rien pour dire ou ca s'est arrete.
const MAX = 200;

// Deux imports successifs ne doivent pas doubler la bibliotheque. On compare
// sur le titre, seul reperage stable : l'enigme elle-meme peut etre retouchee.
export function aImporter(candidates, titresExistants) {
  const vus = new Set(titresExistants.map(t => String(t || '').trim().toLowerCase()));
  const retenues = [];
  for (const c of candidates) {
    if (!c || !c.enigme || typeof c.enigme !== 'object') continue;
    const titre = String(c.titre || c.enigme.title || '').trim();
    if (!titre) continue;
    const cle = titre.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    retenues.push({
      titre: titre.slice(0, 200),
      categorie: String(c.categorie || 'autre').slice(0, 40),
      tags: Array.isArray(c.tags) ? c.tags.slice(0, 10).map(String) : [],
      // L'enigme est reprise telle quelle : c'est du contenu de jeu, pas une
      // consigne. `id` saute — il appartient au jeu d'origine, pas a la
      // bibliotheque.
      enigme: (({ id, ...reste }) => reste)(c.enigme),
    });
  }
  return retenues;
}

export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const candidates = Array.isArray(body.enigmes) ? body.enigmes.slice(0, MAX) : [];
  if (!candidates.length) return json({ error: 'Aucune énigme à importer.' }, 400);

  const sb = adminClient();
  const { data: deja, error: eLire } = await sb.from('bibliotheque_enigmes').select('titre');
  if (eLire) return json({ error: eLire.message }, 500);

  const lignes = aImporter(candidates, (deja || []).map(d => d.titre));
  if (!lignes.length) return json({
    ok: true, ajoutees: 0, ignorees: candidates.length,
    message: 'Ces énigmes sont déjà dans la bibliothèque.',
  });

  const { error } = await sb.from('bibliotheque_enigmes').insert(lignes);
  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    ajoutees: lignes.length,
    ignorees: candidates.length - lignes.length,
  });
};

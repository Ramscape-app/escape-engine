import { adminClient, json } from './_auth.js';

// Informations publiques sur les jeux publiés — le catalogue et l'aperçu du nom
// dans rejoindre.html?slug=.
//
// Endpoint public, mais il ne sélectionne QUE des colonnes non sensibles. La
// table `jeux` contient `enigmas`, c'est-à-dire les énigmes avec leurs réponses :
// c'est précisément ce qui ne doit jamais sortir d'ici. Une policy RLS ne sait
// pas filtrer par colonne, d'où le passage par une fonction serveur.
//
//   GET                → la liste des jeux publiés
//   GET ?slug=<slug>   → un seul jeu
const CHAMPS = 'slug, name, client, version';

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405);

  const slug = new URL(req.url).searchParams.get('slug');
  const sb = adminClient();

  if (slug) {
    const { data, error } = await sb.from('jeux')
      .select(CHAMPS).eq('slug', slug).eq('statut', 'publie').maybeSingle();
    if (error) return json({ error: 'Lecture impossible pour le moment.' }, 500);
    if (!data) return json({ error: 'Jeu introuvable.' }, 404);
    return json({ ok: true, jeu: data });
  }

  const { data, error } = await sb.from('jeux')
    .select(CHAMPS).eq('statut', 'publie').order('name');
  if (error) return json({ error: 'Lecture impossible pour le moment.' }, 500);
  return json({ ok: true, jeux: data || [] });
};

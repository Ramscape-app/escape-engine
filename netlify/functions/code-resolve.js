import { adminClient, json, normaliserCode } from './_auth.js';

// Résout un code d'invitation en nom de jeu, pour l'affichage « Tu rejoins : X ».
//
// Endpoint public, mais délibérément avare : il ne renvoie que le nom et le slug.
// Ni l'identifiant du jeu, ni le quota, ni la date d'expiration ne sortent d'ici —
// et surtout, la table `codes` n'est plus lisible depuis le navigateur, donc les
// codes ne sont plus énumérables.
//
// Il reste possible de tester un code au hasard pour savoir s'il existe : c'est le
// compromis assumé pour garder l'aperçu avant inscription. Tous les cas d'échec
// renvoient donc le même message, pour ne pas distinguer inconnu / désactivé / expiré.
const REFUS = 'Code invalide ou désactivé.';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const code = normaliserCode(body.code);
  if (!code) return json({ error: REFUS }, 404);

  const sb = adminClient();
  const { data, error } = await sb.from('codes')
    .select('actif, expire_le, jeu:jeux(slug, name, statut)')
    .eq('code', code).maybeSingle();

  if (error) return json({ error: 'Vérification impossible pour le moment.' }, 500);
  if (!data || !data.jeu) return json({ error: REFUS }, 404);
  if (data.actif === false) return json({ error: REFUS }, 404);
  if (data.expire_le && new Date(data.expire_le) < new Date()) return json({ error: REFUS }, 404);
  if (data.jeu.statut !== 'publie') return json({ error: REFUS }, 404);

  return json({ ok: true, name: data.jeu.name, slug: data.jeu.slug });
};

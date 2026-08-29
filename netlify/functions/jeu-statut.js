import { adminClient, requireAdmin, json } from './_auth.js';
import { validerJeu, compte } from '../../public/shared/valider-jeu.js';

// Changement de statut d'un jeu.
//
// La publication est le seul moment ou une erreur devient visible par des
// joueurs : c'est donc ici que la verification doit bloquer, et pas seulement
// dans l'editeur ou elle serait contournable. Le meme module sert des deux
// cotes, pour que l'editeur et le serveur disent exactement la meme chose.
export default async (req) => {
  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error }, gate.status);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Requête invalide' }, 400); }

  const { id, statut, forcer } = body;
  if (!id || !['brouillon', 'publie', 'archive'].includes(statut))
    return json({ error: 'paramètres invalides' }, 400);

  const sb = adminClient();

  if (statut === 'publie') {
    const { data: jeu, error: eLect } = await sb.from('jeux')
      .select('name, enigmas, acts, act_boundaries, reglages').eq('id', id).maybeSingle();
    if (eLect) return json({ error: eLect.message }, 500);
    if (!jeu) return json({ error: 'Jeu introuvable' }, 404);

    const problemes = validerJeu({
      meta: { name: jeu.name },
      enigmas: jeu.enigmas, acts: jeu.acts,
      actBoundaries: jeu.act_boundaries, reglages: jeu.reglages,
    });
    const { erreurs } = compte(problemes);

    // Les alertes n'empechent pas : un jeu sans indices reste jouable, c'est un
    // choix. Les erreurs, elles, rendent une enigme infaisable.
    if (erreurs > 0 && !forcer) {
      return json({
        error: `Ce jeu a ${erreurs} probleme(s) qui le rendraient injouable.`,
        problemes,
      }, 409);
    }
  }

  const { error } = await sb.from('jeux').update({ statut }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};

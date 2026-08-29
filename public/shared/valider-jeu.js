// Verification d'un jeu avant publication.
//
// Rien n'empechait jusqu'ici de publier un jeu sans reponse, avec des bornes
// d'actes incoherentes ou un module sans solution : le probleme se decouvrait
// devant les joueurs. Ce module est partage par l'editeur (avertissement en
// continu) et par l'admin (blocage a la publication), pour que les deux disent
// exactement la meme chose.
//
// Deux niveaux : `erreur` empeche la publication, `alerte` la laisse passer.

const FORMATS_SANS_REPONSE = ['puzzle', 'fakebug', 'nfc'];

export function validerJeu(cfg) {
  const pbs = [];
  const ajoute = (niveau, message, enigme) => pbs.push({ niveau, message, enigme });

  const enigmas = Array.isArray(cfg && cfg.enigmas) ? cfg.enigmas : [];
  const actes = Array.isArray(cfg && cfg.acts) ? cfg.acts : [];
  const bornes = Array.isArray(cfg && cfg.actBoundaries) ? cfg.actBoundaries : [];

  if (!cfg || !(cfg.meta && String(cfg.meta.name || '').trim())) {
    ajoute('erreur', "Le jeu n'a pas de nom.");
  }
  if (!enigmas.length) {
    ajoute('erreur', "Le jeu ne contient aucune enigme.");
    return pbs;                                  // le reste n'a plus de sens
  }

  // ── Chaque enigme ──
  enigmas.forEach((e, i) => {
    const n = i + 1;
    const titre = String((e && (e.title || e.question)) || '').trim();
    if (!titre) ajoute('alerte', `Enigme ${n} : ni titre ni question.`, i);

    const format = (e && e.format) || 'text';
    const reponses = Array.isArray(e && e.answer) ? e.answer.filter(a => String(a).trim()) : [];
    const valideParModule = !!(e && e.iframe && /[?&]validate=1(&|$)/.test(e.iframe));

    // Un format a saisie sans reponse est injouable : le joueur reste bloque.
    if (!reponses.length && !valideParModule && !FORMATS_SANS_REPONSE.includes(format)) {
      ajoute('erreur', `Enigme ${n} : aucune reponse acceptee, elle sera impossible a valider.`, i);
    }
    if (format === 'keypad' && reponses.length && !/^[0-9]+$/.test(String(reponses[0]))) {
      ajoute('erreur', `Enigme ${n} : le clavier numerique attend une reponse en chiffres.`, i);
    }
    if (format === 'gps' && !(e.lat && e.lng)) {
      ajoute('erreur', `Enigme ${n} : enigme GPS sans coordonnees.`, i);
    }
    if (format === 'audio' && !e.audioId) {
      ajoute('alerte', `Enigme ${n} : enigme audio sans element sonore.`, i);
    }

    // Modules maison : une solution vide rend le module infaisable.
    const m = /^module\/([a-z0-9-]+)\.html(?:\?(.*))?$/.exec(String((e && e.iframe) || ''));
    if (m) {
      const q = new URLSearchParams(m[2] || '');
      const attendus = { cadenas:'solution', piano:'sequence', simon:'sequence',
                         'mots-meles':'mots', 'mots-melanged':'mot', 'guess-where':'lat' };
      const cle = attendus[m[1]];
      if (cle && !q.get(cle)) {
        ajoute('erreur', `Enigme ${n} : le module « ${m[1]} » n'a pas de ${cle}.`, i);
      }
    }
    if (e && e.iframe && !m && !/^https?:\/\//.test(e.iframe)) {
      ajoute('erreur', `Enigme ${n} : l'integration n'est ni un module connu ni une URL valide.`, i);
    }
    if (!e || !e.hint || !String(e.hint).trim()) {
      ajoute('alerte', `Enigme ${n} : pas d'indice. Une equipe bloquee n'aura aucune aide.`, i);
    }
  });

  // ── Decoupage en actes ──
  if (actes.length) {
    if (bornes.length !== actes.length + 1) {
      ajoute('erreur', `Decoupage incoherent : ${actes.length} acte(s) demandent ${actes.length + 1} bornes, il y en a ${bornes.length}.`);
    } else {
      if (bornes[0] !== 0) ajoute('erreur', "La premiere borne d'acte doit valoir 0.");
      if (bornes[bornes.length - 1] !== enigmas.length) {
        ajoute('erreur', `La derniere borne d'acte vaut ${bornes[bornes.length - 1]} au lieu de ${enigmas.length}.`);
      }
      for (let i = 1; i < bornes.length; i++) {
        if (bornes[i] < bornes[i - 1]) { ajoute('erreur', "Les bornes d'actes ne sont pas croissantes."); break; }
        if (bornes[i] === bornes[i - 1]) ajoute('alerte', `L'acte ${i} ne contient aucune enigme.`);
      }
    }
    actes.forEach((a, i) => {
      if (!a || !String(a.name || '').trim()) ajoute('alerte', `L'acte ${i + 1} n'a pas de nom.`);
    });
  }

  const d = cfg.reglages && cfg.reglages.dureeMinutes;
  if (d !== undefined && d !== null && d !== '') {
    const r = parseInt(d, 10);
    if (!Number.isFinite(r) || r <= 0) {
      ajoute('erreur', 'La duree indicative doit etre un nombre de minutes positif.');
    }
  }

  return pbs;
}

export const compte = (pbs) => ({
  erreurs: pbs.filter(p => p.niveau === 'erreur').length,
  alertes: pbs.filter(p => p.niveau === 'alerte').length,
});

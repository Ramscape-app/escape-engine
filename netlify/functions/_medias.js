import { randomBytes } from 'node:crypto';

// ── Les règles du bucket privé `reponses` ─────────────────────────────────
//
// Un seul endroit décide de ce qui est acceptable, parce que ces règles sont
// appliquées sur deux chemins (l'URL signée, puis la confirmation) et que deux
// listes qui divergent, c'est une liste qui ne sert plus à rien.

export const BUCKET = 'reponses';

// L'extension vient du type déclaré, JAMAIS du nom de fichier envoyé. Un
// « photo.jpg.html » ou un « ../../x.svg » n'a alors aucun effet : le nom
// d'origine ne sert qu'à l'affichage.
export const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
};

// 20 Mo : une photo de téléphone récent tient dedans, une vidéo non — et c'est
// voulu (voir migration-09). Le bucket plafonne à 25 Mo en dernier recours.
export const TAILLE_MAX = 20 * 1024 * 1024;

// Par question, pas par complice : cinq photos pour illustrer un souvenir
// suffisent, et le plafond doit être là où le formulaire le rend lisible.
export const MAX_PAR_QUESTION = 5;

// Chemin de destination. Trois raisons à cette forme :
//  - il est entièrement décidé par le serveur, donc insensible à ce que le
//    navigateur raconte ;
//  - le fragment aléatoire fait qu'aucun envoi n'écrase un autre, même à nom
//    de fichier identique et à la même seconde ;
//  - il reste lisible en console, rangé par complice puis par question.
export function cheminMedia(compliceId, questionId, type) {
  const ext = TYPES[type];
  if (!ext) return null;
  return `${compliceId}/${questionId}/${randomBytes(12).toString('hex')}.${ext}`;
}

// Un chemin reçu du navigateur (à la confirmation, à la lecture, à la
// promotion) doit être l'un de ceux qu'on a soi-même émis : sous le dossier du
// complice, et sans détour possible. Sans ce contrôle, un porteur de lien
// demanderait une URL signée sur les fichiers d'un autre.
// Découpé plutôt que passé à une expression construite : fabriquer une regex
// avec une valeur venue de la base marche jusqu'au jour où cette valeur porte
// un caractère qui veut dire autre chose dans une regex.
export function cheminAutorise(chemin, compliceId) {
  const p = String(chemin || '');
  if (!p || p.includes('..') || p.startsWith('/')) return false;
  const parts = p.split('/');
  if (parts.length !== 3) return false;
  const [dossier, question, fichier] = parts;
  return dossier === String(compliceId)
    && /^[a-z0-9_]+$/.test(question)
    && /^[0-9a-f]{24}\.[a-z0-9]{2,5}$/.test(fichier);
}

// Ce qu'on garde d'un média en base : rien de ce que le navigateur a envoyé
// n'est repris tel quel, hors le nom d'origine, borné et destiné au seul
// affichage.
export function entreeMedia({ path, nom, type, taille }) {
  return {
    path,
    nom: String(nom || 'fichier').slice(0, 120),
    type,
    taille: Number(taille) || 0,
    ajoute_le: new Date().toISOString(),
  };
}

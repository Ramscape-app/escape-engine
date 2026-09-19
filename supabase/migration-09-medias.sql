-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 3 — Les médias envoyés par les complices
--  À exécuter dans Supabase → SQL Editor, après migration-08-questionnaires.sql.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ⚠️ Strictement ADDITIF : une colonne nullable et un bucket de stockage neuf.


-- ── 1. Les fichiers attachés à une réponse ─────────────────────────────────
-- Une question de type `media` demande une photo, pas une phrase : la photo du
-- voyage, le faire-part, l'enregistrement d'une voix. `valeur` garde la
-- description en texte, `medias` la liste des fichiers.
--
--   [{ "path": "<complice>/<question>/<aleatoire>.jpg",
--      "nom": "IMG_4213.jpg",        ← nom d'origine, pour l'affichage seulement
--      "type": "image/jpeg",
--      "taille": 1843221,
--      "ajoute_le": "2026-03-04T18:22:00Z",
--      "promu": "mariage-dupont/1740000000-photo.jpg" }]  ← si promu vers `assets`
--
-- `path` est le chemin dans le bucket PRIVE `reponses`. `promu` n'apparait que
-- si l'organisateur a explicitement fait passer le fichier dans `assets`, le
-- bucket public que lit le moteur de jeu.

alter table public.reponses
  add column if not exists medias jsonb not null default '[]'::jsonb;


-- ── 2. Le bucket privé ─────────────────────────────────────────────────────
-- `public = false`, et c'est le point entier de cette migration.
--
-- Ce que les complices envoient, ce sont des photos de famille, confiées pour
-- une surprise. Le bucket `assets` est public : une URL devinable y suffit a
-- tout lire. Ces fichiers n'y ont donc rien a faire, et n'y arrivent que si
-- l'organisateur les y met lui-meme, fichier par fichier, une fois qu'il sait
-- qu'ils serviront dans une enigme.
--
-- Aucune policy sur `storage.objects` pour ce bucket : la cle de service
-- traverse RLS, et c'est le seul acces. Un complice n'ecrit jamais en direct —
-- il recoit une URL signee, valable quelques minutes, pour un chemin decide par
-- le serveur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reponses', 'reponses', false,
  26214400,                         -- 25 Mo, dernier rempart cote stockage
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'audio/mpeg','audio/mp4','audio/m4a','audio/x-m4a','audio/ogg','audio/wav','audio/webm'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Ce qui n'est PAS fait ici ──────────────────────────────────────────────
-- Pas de `image/svg+xml` : un SVG est un document executable. Rien dans une
-- photo de famille n'en a besoin, et l'accepter ouvrirait une porte pour rien.
-- Pas de video non plus pour l'instant : le poids change la nature du probleme
-- (transcodage, lecture en continu) et aucune enigme n'en demande.


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- alter table public.reponses drop column if exists medias;
-- delete from storage.objects where bucket_id = 'reponses';
-- delete from storage.buckets where id = 'reponses';

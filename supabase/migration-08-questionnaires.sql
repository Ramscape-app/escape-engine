-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 2 — Questionnaires, complices et réponses
--  À exécuter dans Supabase → SQL Editor, après migration-07-clients.sql.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ⚠️ Strictement ADDITIF : trois tables neuves, aucune colonne existante
--     touchée. `main` continue de tourner sans rien voir.


-- ── 1. Le questionnaire d'un client ────────────────────────────────────────
-- Un client peut en avoir plusieurs : le questionnaire du conjoint n'est pas
-- celui des collegues de bureau. Chacun porte sa selection de questions.
--
-- `items` est la selection, dans l'ordre d'affichage :
--   [{ "q": "annee_rencontre",
--      "libelle": "En quelle annee vous etes-vous rencontres ?",  (facultatif)
--      "valeur": "2014",                                          (facultatif)
--      "obligatoire": true }]
--
-- `libelle` surcharge celui du catalogue quand il faut tutoyer le complice ou
-- nommer les personnes. `valeur` pre-remplit : ce que l'organisateur sait deja,
-- que le complice n'a qu'a confirmer ou corriger.
--
-- Pourquoi du jsonb et non une table de liaison : la selection est courte
-- (quelques dizaines de lignes), elle se lit et s'ecrit toujours d'un bloc, et
-- l'ordre comme la personnalisation lui appartiennent en propre. Une table de
-- liaison couterait une jointure a chaque affichage sans rien apporter.

create table if not exists public.questionnaires (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  nom           text not null default 'Questionnaire',
  items         jsonb not null default '[]'::jsonb,
  -- Le mot d'accueil que lira le complice en ouvrant le lien. C'est lui qui
  -- explique qu'il s'agit d'une surprise et qu'il ne faut pas en parler.
  mot_accueil   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_questionnaires_client
  on public.questionnaires(client_id, created_at);


-- ── 2. Les complices ───────────────────────────────────────────────────────
-- Chacun recoit son propre lien. Un jeton par complice et non un par
-- questionnaire : on sait ainsi qui a repondu quoi, qui n'a pas ouvert son
-- lien, et on peut en revoquer un sans couper les autres.
--
-- `jeton` EST le mot de passe du lien : il est tire au sort cote serveur sur
-- 24 octets. Il n'y a pas d'autre authentification — un complice n'a pas de
-- compte, et lui en demander un le ferait abandonner.

create table if not exists public.complices (
  id                uuid primary key default gen_random_uuid(),
  questionnaire_id  uuid not null references public.questionnaires(id) on delete cascade,
  nom               text not null,
  relation          text,                    -- « soeur », « meilleur ami », « collegue »
  jeton             text not null unique,
  -- Dates de suivi : savoir qui relancer sans avoir a le demander.
  ouvert_le         timestamptz,             -- premiere ouverture du lien
  termine_le        timestamptz,             -- le complice a declare avoir fini
  created_at        timestamptz not null default now()
);

create index if not exists idx_complices_jeton on public.complices(jeton);
create index if not exists idx_complices_questionnaire
  on public.complices(questionnaire_id, created_at);


-- ── 3. Les réponses ────────────────────────────────────────────────────────
-- Une ligne par (complice, question), remplacee a chaque frappe enregistree :
-- le complice repond sur son telephone, entre deux choses, et ne doit jamais
-- perdre ce qu'il a ecrit parce qu'il a ferme l'onglet.
--
-- ⚠️ `question_id` n'a VOLONTAIREMENT pas de cle etrangere vers `questions`.
--    Une reponse est de la matiere d'enigme deja collectee : la perdre parce
--    que la question a ete retiree du catalogue serait le pire des defauts.
--    Le libelle exact tel qu'il a ete pose est copie dans `libelle_pose` pour
--    que la reponse reste lisible meme si la question change ou disparait.

create table if not exists public.reponses (
  id            uuid primary key default gen_random_uuid(),
  complice_id   uuid not null references public.complices(id) on delete cascade,
  question_id   text not null,
  libelle_pose  text,
  valeur        text,
  updated_at    timestamptz not null default now(),
  unique (complice_id, question_id)
);

create index if not exists idx_reponses_complice on public.reponses(complice_id);
create index if not exists idx_reponses_question on public.reponses(question_id);


-- ── 4. RLS : aucune policy, donc aucun accès navigateur ────────────────────
-- Meme regle que `clients` et `questions` : ces tables ne sont touchees que par
-- les fonctions serveur a cle de service.
--
-- C'est ici que ca compte le plus. Le complice n'a pas de compte : il arrive en
-- `anon`. Sans RLS active il lirait les reponses de tous les autres complices,
-- de tous les clients. Avec RLS active et zero policy, `anon` ne voit rien du
-- tout, et son acces passe exclusivement par `repondre-charger` /
-- `repondre-enregistrer`, qui le cadrent sur son seul jeton.

alter table public.questionnaires enable row level security;
alter table public.complices      enable row level security;
alter table public.reponses       enable row level security;


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- drop table if exists public.reponses;
-- drop table if exists public.complices;
-- drop table if exists public.questionnaires;

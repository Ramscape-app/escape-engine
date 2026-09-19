-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 1 — Clients et catalogue de questions
--  À exécuter dans Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ⚠️ Strictement ADDITIF : deux tables neuves et une colonne nullable.
--     `jeux.client` (texte libre) n'est pas touchée et sert de repli, donc
--     `main` continue de tourner sans rien voir.


-- ── 1. Les clients ─────────────────────────────────────────────────────────
-- Un client peut revenir : la fiche vit a part et porte l'historique de ses
-- evenements, ses contacts et ses questionnaires.

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  contact_nom   text,
  email         text,
  telephone     text,
  -- La fiche projet : ce qui se remplit entre l'organisateur et le client, et
  -- qui n'est JAMAIS partage avec un complice (budget, logistique, contraintes).
  projet        jsonb not null default '{}'::jsonb,
  note          text,
  statut        text not null default 'prospect'
                check (statut in ('prospect','en_cours','livre','archive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_clients_statut on public.clients(statut, created_at desc);

-- Rattachement des jeux. `jeux.client` (texte) reste en place : les jeux
-- existants gardent leur valeur et le moteur n'y voit que du feu.
alter table public.jeux
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists idx_jeux_client on public.jeux(client_id);


-- ── 2. Le catalogue de questions ───────────────────────────────────────────
-- Meme motif que `bibliotheque_enigmes` : un catalogue global, enrichissable,
-- reutilise d'un client a l'autre.
--
-- `ingredient` est le champ qui change tout : il dit ce que la reponse produira
-- comme matiere d'enigme. Sans lui on a un formulaire ; avec lui, l'editeur peut
-- proposer « voici les chiffres disponibles pour ce client » au moment de poser
-- un cadenas.
--
--   chiffre  → cadenas a molettes, clavier numerique, codes
--   mot      → reponse texte, mots meles, anagramme
--   lieu     → enigme GPS, guess-where
--   media    → image d'enigme, lampe UV, camera
--   liste    → QCM, associations, rebus
--   recit    → narration, indices, ton du jeu

create table if not exists public.questions (
  id          text primary key,              -- slug lisible, ex. 'annee_rencontre'
  section     text not null,
  libelle     text not null,
  aide        text,
  type        text not null default 'texte'
              check (type in ('texte','texte_long','nombre','date','liste','choix','media')),
  ingredient  text not null default 'recit'
              check (ingredient in ('chiffre','mot','lieu','media','liste','recit')),
  options     jsonb not null default '[]'::jsonb,   -- pour les questions a choix
  ordre       int not null default 0,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_questions_section on public.questions(section, ordre);


-- ── 3. Policies ────────────────────────────────────────────────────────────
-- Aucune lecture depuis le navigateur : tout passe par les fonctions serveur,
-- comme pour `codes`. Ces tables contiennent des donnees commerciales et
-- personnelles, elles n'ont rien a faire cote client.

alter table public.clients enable row level security;
alter table public.questions enable row level security;


-- ── 4. Amorcage du catalogue ───────────────────────────────────────────────
-- Base de depart, editable et extensible depuis l'admin. Elle grossira a chaque
-- client : une question posee une fois vaut la peine d'etre gardee.

insert into public.questions (id, section, libelle, aide, type, ingredient, ordre) values
-- ── Identite ──
('prenom',            'identite','Prenom(s) du heros',null,'texte','mot',10),
('surnom',            'identite','Surnom(s), petit nom','Ceux que seuls les proches utilisent','liste','mot',20),
('date_naissance',    'identite','Date de naissance',null,'date','chiffre',30),
('ville_naissance',   'identite','Ville de naissance',null,'texte','lieu',40),
('ville_residence',   'identite','Ville ou il/elle vit aujourd''hui',null,'texte','lieu',50),
('metier',            'identite','Metier actuel',null,'texte','mot',60),
('parcours_pro',      'identite','Parcours professionnel','Les etapes marquantes, les reconversions','texte_long','recit',70),

-- ── Personnalite ──
('traits',            'personnalite','Traits de caractere','En trois mots si tu devais resumer','liste','mot',10),
('manies',            'personnalite','Manies, tics, petites habitudes','Ce qui fait rire tout le monde','texte_long','recit',20),
('expressions',       'personnalite','Expressions fetiches','Les phrases qu''il/elle repete tout le temps','liste','mot',30),
('private_jokes',     'personnalite','Private jokes et vannes recurrentes',null,'texte_long','recit',40),
('tout_le_monde_sait','personnalite','Ce que TOUT LE MONDE sait sur cette personne','Parfait pour une enigme facile en ouverture','texte_long','recit',50),
('peu_de_gens_savent','personnalite','Ce que PEU DE GENS savent','Pour un effet revelation en fin de jeu','texte_long','recit',60),
('fierte',            'personnalite','Ce dont il/elle est le plus fier(e)',null,'texte_long','recit',70),
('peur',              'personnalite','Une peur ou une phobie assumee','A manier avec precaution','texte','mot',80),

-- ── Gouts et culture ──
('films',             'gouts','Films ou series cultes',null,'liste','liste',10),
('acteurs',           'gouts','Acteurs et actrices preferes',null,'liste','liste',20),
('musiques',          'gouts','Chansons, artistes, groupes','La chanson qui le/la fait danser a coup sur','liste','liste',30),
('livres',            'gouts','Livres, BD, podcasts',null,'liste','liste',40),
('plats',             'gouts','Plats preferes',null,'liste','mot',50),
('restos',            'gouts','Restaurants ou bars de predilection','Avec la ville, si possible','liste','lieu',60),
('boisson',           'gouts','Sa boisson','Celle qu''on lui sert sans demander','texte','mot',70),
('marques',           'gouts','Marques, objets ou vetements fetiches',null,'liste','mot',80),
('jeux_video',        'gouts','Jeux video ou jeux de societe',null,'liste','liste',90),
('animaux',           'gouts','Animaux','Noms et especes — excellents mots de passe','liste','mot',100),

-- ── Sport et activites ──
('sport_avant',       'sport','Sport pratique plus jeune','Souvent une mine : le club, le poste, les surnoms','texte_long','recit',10),
('sport_aujourdhui',  'sport','Sport pratique aujourd''hui',null,'liste','mot',20),
('equipes',           'sport','Equipes ou sportifs favoris',null,'liste','liste',30),
('exploit_sportif',   'sport','Un exploit ou une humiliation sportive','Les deux font de bonnes enigmes','texte_long','recit',40),
('hobbies',           'sport','Hobbies et passions','Jardinage, bricolage, collections, benevolat...','liste','liste',50),
('collection',        'sport','Collectionne-t-il/elle quelque chose ?',null,'texte','mot',60),

-- ── Enfance et famille ──
('enfance_lieu',      'enfance','Ou a-t-il/elle grandi ?',null,'texte','lieu',10),
('enfance_anecdote',  'enfance','Une anecdote d''enfance restee celebre',null,'texte_long','recit',20),
('ecole',             'enfance','Ecoles, fac, grandes etapes',null,'liste','lieu',30),
('fratrie',           'enfance','Freres et soeurs','Prenoms et ordre de naissance','liste','mot',40),
('surnom_famille',    'enfance','Le surnom donne par la famille',null,'texte','mot',50),
('premier_job',       'enfance','Son tout premier travail',null,'texte','mot',60),

-- ── Histoire (couple ou groupe) ──
('rencontre',         'histoire','Comment se sont-ils rencontres ?',null,'texte_long','recit',10),
('premier_rdv',       'histoire','Le premier rendez-vous','Lieu, date, ce qui s''est mal passe','texte_long','recit',20),
('moments',           'histoire','Moments memorables','Les plus droles ou genants font les meilleures enigmes','texte_long','recit',30),
('voyages',           'histoire','Voyages marquants',null,'liste','lieu',40),
('voyage_reve',       'histoire','La destination dont il/elle reve',null,'texte','lieu',50),
('demande',           'histoire','La demande en mariage, ou le moment decisif',null,'texte_long','recit',60),
('galere',            'histoire','Une galere traversee ensemble','Panne, demenagement rate, vacances catastrophe','texte_long','recit',70),

-- ── Chiffres cles ──
('annee_rencontre',   'chiffres','Annee de la rencontre',null,'nombre','chiffre',10),
('annee_mariage',     'chiffres','Annee du mariage ou du pacs',null,'nombre','chiffre',20),
('annees_ensemble',   'chiffres','Nombre d''annees ensemble',null,'nombre','chiffre',30),
('nb_enfants',        'chiffres','Nombre d''enfants',null,'nombre','chiffre',40),
('nb_animaux',        'chiffres','Nombre d''animaux',null,'nombre','chiffre',50),
('numero_fetiche',    'chiffres','Numero fetiche','Maillot, porte-bonheur, jour de naissance...','nombre','chiffre',60),
('dates_importantes', 'chiffres','Autres dates importantes',null,'liste','chiffre',70),
('adresse_marquante', 'chiffres','Un numero d''adresse marquant','Le premier appartement, la maison d''enfance','nombre','chiffre',80),

-- ── Lieux ──
('lieu_symbolique',   'lieux','Lieux symboliques','Premier RDV, ville d''origine, lieu de vacances — avec adresse si possible','liste','lieu',10),
('lieu_evenement',    'lieux','Lieu de l''evenement','Nom et adresse complete','texte','lieu',20),
('lieu_secret',       'lieux','Un lieu que peu de gens connaissent',null,'texte','lieu',30),

-- ── Medias ──
('photo_heros',       'medias','Une photo du/des heros','De preference recente et nette','media','media',10),
('photo_enfance',     'medias','Une photo d''enfance','Excellente pour une revelation progressive','media','media',20),
('photo_souvenir',    'medias','Une photo d''un moment marquant',null,'media','media',30),
('audio_message',     'medias','Un message audio pour la fin du jeu','Quelques secondes suffisent','media','media',40),
('objet_fetiche',     'medias','Photo d''un objet fetiche',null,'media','media',50),

-- ── Ton et limites ──
('sujets_interdits',  'ton','Sujets ou personnes a NE PAS mentionner','Important : on s''y tiendra strictement','texte_long','recit',10),
('niveau_vannes',     'ton','Jusqu''ou peut-on charrier ?','De « tout en douceur » a « aucune limite »','choix','recit',20),
('enigmes_aimees',    'ton','Types d''enigmes qui plairaient',null,'liste','liste',30),
('enigmes_evitees',   'ton','Types d''enigmes a eviter',null,'liste','liste',40),
('idee_imposee',      'ton','Une idee a inclure absolument',null,'texte_long','recit',50),
('inspiration',       'ton','References ou inspirations','Un film, un jeu, une ambiance qui plait','texte_long','recit',60),
('libre',             'ton','Quoi d''autre ?','Tout ce qui te passe par la tete et qu''on n''a pas demande','texte_long','recit',70)
on conflict (id) do nothing;

update public.questions set options =
  '["Tout en douceur","Quelques piques amicales","On peut y aller","Aucune limite"]'::jsonb
where id = 'niveau_vannes';


-- ── Vérification ───────────────────────────────────────────────────────────
--
--  select section, count(*) from public.questions group by section order by 1;
--  select ingredient, count(*) from public.questions group by ingredient order by 2 desc;
--    → doit totaliser 67 questions


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- alter table public.jeux drop column client_id;
-- drop table public.questions;
-- drop table public.clients;

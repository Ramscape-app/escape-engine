-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 2 — Jeu en équipe
--  À exécuter dans Supabase → SQL Editor, APRÈS déploiement de `evolution`.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ⚠️ `main` et `evolution` partagent la même base. Cette migration est donc
--     strictement ADDITIVE : trois tables neuves et une colonne nullable.
--     `parties` n'est PAS touchée — elle continue de servir le mode solo que
--     `main` fait tourner aujourd'hui.
--
--  Principe retenu : un code d'invitation = une équipe. `codes.label` la nomme,
--  `codes.max_joueurs` la plafonne. Rien de plus à saisir pour le joueur.


-- ── 1. Les équipes ─────────────────────────────────────────────────────────

create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique references public.codes(code) on delete cascade,
  jeu_id      uuid not null references public.jeux(id) on delete cascade,
  nom         text,
  created_at  timestamptz not null default now()
);

-- Rattachement du joueur. NULL = mode solo, c'est-à-dire tous les comptes
-- existants et tout ce qui tourne sur `main`.
alter table public.joueurs
  add column if not exists equipe_id uuid references public.equipes(id) on delete set null;

create index if not exists idx_joueurs_equipe on public.joueurs(equipe_id);


-- ── 2. La progression partagée ─────────────────────────────────────────────
-- Même forme que `parties`, mais portée par l'équipe. Table distincte plutôt
-- que colonne ajoutée : `parties` reste intacte pour le mode solo.

create table if not exists public.parties_equipe (
  id                uuid primary key default gen_random_uuid(),
  equipe_id         uuid not null references public.equipes(id) on delete cascade,
  jeu_id            uuid not null references public.jeux(id) on delete cascade,
  enigme_courante   int  not null default 0,
  resolues          jsonb not null default '[]'::jsonb,
  indices_utilises  jsonb not null default '[]'::jsonb,
  termine           boolean not null default false,
  updated_at        timestamptz not null default now(),
  unique (equipe_id, jeu_id)
);


-- ── 3. Le fil d'activité ───────────────────────────────────────────────────
-- Exigence : le jeu ne doit jamais avancer sans qu'on sache ce qui s'est passé.
-- Chaque proposition, juste ou fausse, y est tracée avec son auteur.
--
--   arrivee      · un joueur rejoint l'équipe
--   proposition  · une réponse tentée      (contenu = la réponse, reussie = son sort)
--   resolue      · une énigme validée
--   indice       · un indice consulté
--   organisateur · un message poussé depuis l'admin (phase 3)

create table if not exists public.activite (
  id            uuid primary key default gen_random_uuid(),
  equipe_id     uuid not null references public.equipes(id) on delete cascade,
  joueur_id     uuid references auth.users(id) on delete set null,
  pseudo        text,                         -- figé : reste lisible si le compte part
  type          text not null check (type in ('arrivee','proposition','resolue','indice','organisateur')),
  enigme_index  int,
  contenu       text,
  reussie       boolean,
  created_at    timestamptz not null default now()
);

create index if not exists idx_activite_equipe on public.activite(equipe_id, created_at desc);


-- ── 4. Policies ────────────────────────────────────────────────────────────
-- Même motif que policies-s02-jeux.sql : un `exists` sur `joueurs`, dont la
-- policy « lire son profil » (auth.uid() = id) s'applique dans la sous-requête.
-- `joueurs` ne référence aucune de ces tables : pas de récursion possible.

alter table public.equipes         enable row level security;
alter table public.parties_equipe  enable row level security;
alter table public.activite        enable row level security;

-- Un joueur ne voit que SON équipe.
create policy "lire son equipe" on public.equipes
  for select to authenticated
  using (exists (select 1 from public.joueurs j
                 where j.id = auth.uid() and j.equipe_id = equipes.id));

-- La création d'équipe est réservée au serveur (rejoindre.js, clé de service) :
-- aucune policy d'insertion n'est accordée au navigateur.

-- Progression : lecture et écriture limitées à sa propre équipe.
create policy "lire la partie de son equipe" on public.parties_equipe
  for select to authenticated
  using (exists (select 1 from public.joueurs j
                 where j.id = auth.uid() and j.equipe_id = parties_equipe.equipe_id));

create policy "creer la partie de son equipe" on public.parties_equipe
  for insert to authenticated
  with check (exists (select 1 from public.joueurs j
                      where j.id = auth.uid() and j.equipe_id = parties_equipe.equipe_id));

create policy "maj la partie de son equipe" on public.parties_equipe
  for update to authenticated
  using (exists (select 1 from public.joueurs j
                 where j.id = auth.uid() and j.equipe_id = parties_equipe.equipe_id));

-- Activité : on lit tout le fil de son équipe, on n'écrit qu'en son propre nom.
create policy "lire l activite de son equipe" on public.activite
  for select to authenticated
  using (exists (select 1 from public.joueurs j
                 where j.id = auth.uid() and j.equipe_id = activite.equipe_id));

create policy "ecrire dans l activite de son equipe" on public.activite
  for insert to authenticated
  with check (
    joueur_id = auth.uid()
    and type <> 'organisateur'          -- réservé aux fonctions serveur
    and exists (select 1 from public.joueurs j
                where j.id = auth.uid() and j.equipe_id = activite.equipe_id)
  );


-- ── 5. Realtime ────────────────────────────────────────────────────────────
-- Sans cette publication, les abonnements du moteur ne reçoivent rien.

alter publication supabase_realtime add table public.activite;
alter publication supabase_realtime add table public.parties_equipe;


-- ── 6. Vérification ────────────────────────────────────────────────────────
--
--  select tablename, policyname, cmd, roles from pg_policies
--  where schemaname='public' and tablename in ('equipes','parties_equipe','activite');
--    → 6 lignes, toutes en {authenticated}
--
--  select tablename from pg_publication_tables where pubname='supabase_realtime';
--    → doit contenir activite et parties_equipe
--
--  Test de non-régression, le plus important : un joueur SANS equipe_id doit
--  continuer de jouer en solo exactement comme avant.


-- ── Retour arrière ─────────────────────────────────────────────────────────
--
-- alter publication supabase_realtime drop table public.activite;
-- alter publication supabase_realtime drop table public.parties_equipe;
-- alter table public.joueurs drop column equipe_id;
-- drop table public.activite;
-- drop table public.parties_equipe;
-- drop table public.equipes;

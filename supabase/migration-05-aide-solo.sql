-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 3bis — Aider aussi un joueur seul
--  À exécuter dans Supabase → SQL Editor, APRÈS déploiement de `evolution`.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  L'aide à distance ne marchait que par équipe. Un joueur solo — donc tous les
--  comptes créés avant les équipes, et quiconque joue seul — n'apparaissait même
--  pas dans la console. Deux verrous à lever :
--
--    1. `activite.equipe_id` était obligatoire : un message à un joueur seul
--       n'avait nulle part où aller.
--    2. Le moteur d'un joueur solo n'était abonné à rien, et `parties` n'était
--       pas publiée en Realtime : un déblocage ne lui serait jamais parvenu.
--
--  ⚠️ `activite` a été créée en phase 2 et `main` ne la touche jamais : la rendre
--     plus souple ne peut donc pas l'affecter. `parties` n'est pas modifiée, on
--     l'ajoute seulement à la publication Realtime — ce que `main`, qui ne
--     s'abonne à rien, ne verra pas.


-- ── 1. Une activité peut viser une équipe OU un joueur ─────────────────────

alter table public.activite alter column equipe_id drop not null;

alter table public.activite
  add column if not exists joueur_cible uuid references auth.users(id) on delete cascade;

-- Exactement l'un des deux : une entrée sans destinataire n'aurait aucun sens,
-- et une entrée avec les deux serait ambiguë à lire.
alter table public.activite drop constraint if exists activite_cible;
alter table public.activite add constraint activite_cible check (
  (equipe_id is not null and joueur_cible is null) or
  (equipe_id is null     and joueur_cible is not null)
);

create index if not exists idx_activite_joueur on public.activite(joueur_cible, created_at desc);


-- ── 2. Policies : élargir « son équipe » à « son équipe ou soi-même » ──────

drop policy if exists "lire l activite de son equipe" on public.activite;
create policy "lire son activite" on public.activite
  for select to authenticated
  using (
    joueur_cible = auth.uid()
    or exists (select 1 from public.joueurs j
               where j.id = auth.uid() and j.equipe_id = activite.equipe_id)
  );

drop policy if exists "ecrire dans l activite de son equipe" on public.activite;
create policy "ecrire son activite" on public.activite
  for insert to authenticated
  with check (
    joueur_id = auth.uid()
    and type <> 'organisateur'          -- toujours réservé aux fonctions serveur
    and (
      joueur_cible = auth.uid()
      or exists (select 1 from public.joueurs j
                 where j.id = auth.uid() and j.equipe_id = activite.equipe_id)
    )
  );

-- La policy « admin lit l activite » de migration-03 continue de s'appliquer :
-- elle ne référence ni equipe_id ni joueur_cible.


-- ── 3. La console doit voir les parties solo, et le joueur les recevoir ────

create policy "admin lit les parties" on public.parties
  for select to authenticated
  using (exists (select 1 from public.admins a where a.id = auth.uid()));

-- Sans cette publication, un déblocage n'atteindrait jamais le joueur solo.
alter publication supabase_realtime add table public.parties;


-- ── Vérification ───────────────────────────────────────────────────────────
--
--  select conname from pg_constraint where conrelid='public.activite'::regclass;
--    → doit contenir activite_cible
--
--  select tablename from pg_publication_tables where pubname='supabase_realtime';
--    → doit contenir activite, parties_equipe ET parties
--
--  Connecté en joueur solo :
--    await sb.from('activite').select('*')   → seulement ce qui le vise
--  Connecté en joueur d'équipe : inchangé, seulement le fil de son équipe.


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- alter publication supabase_realtime drop table public.parties;
-- drop policy "admin lit les parties" on public.parties;
-- alter table public.activite drop constraint activite_cible;
-- alter table public.activite drop column joueur_cible;
-- (repasser equipe_id en not null suppose qu'aucune ligne solo ne subsiste)

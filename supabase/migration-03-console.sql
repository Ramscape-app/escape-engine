-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 3 — Console de l'organisateur
--  À exécuter dans Supabase → SQL Editor, APRÈS déploiement de `evolution`.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Un administrateur est dans `admins`, PAS dans `joueurs`. Or les policies de
--  la phase 2 cadrent toutes sur `joueurs.equipe_id` : elles l'excluent donc
--  entièrement. Et comme Realtime applique RLS à chaque abonné, la console ne
--  recevrait rien en direct sans ces trois policies.
--
--  Les policies permissives s'ADDITIONNENT : celles des joueurs ne sont pas
--  affaiblies. Et l'admin n'obtient rien qu'il n'ait déjà via les fonctions
--  serveur à clé de service — il gagne seulement de le lire en direct.
--
--  ⚠️ Additif uniquement : aucune policy existante n'est touchée.

create policy "admin lit les equipes" on public.equipes
  for select to authenticated
  using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "admin lit les parties d equipe" on public.parties_equipe
  for select to authenticated
  using (exists (select 1 from public.admins a where a.id = auth.uid()));

create policy "admin lit l activite" on public.activite
  for select to authenticated
  using (exists (select 1 from public.admins a where a.id = auth.uid()));

-- Aucune policy d'ÉCRITURE pour l'admin : les messages et les déblocages passent
-- par les fonctions serveur (equipe-message, equipe-debloquer), qui utilisent la
-- clé de service. La policy d'insertion de la phase 2 interdit déjà au navigateur
-- d'écrire un `type = 'organisateur'`, quel que soit l'utilisateur.


-- ── Vérification ───────────────────────────────────────────────────────────
--
--  select tablename, policyname, cmd from pg_policies
--  where schemaname='public' and tablename in ('equipes','parties_equipe','activite')
--  order by tablename, policyname;
--    → 9 lignes : les 6 de la phase 2 + les 3 ci-dessus
--
--  Connecté en ADMIN dans la console du navigateur :
--    await sb.from('activite').select('*')      → des lignes de toutes les équipes
--  Connecté en JOUEUR :
--    await sb.from('activite').select('*')      → seulement celles de SON équipe


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- drop policy "admin lit les equipes" on public.equipes;
-- drop policy "admin lit les parties d equipe" on public.parties_equipe;
-- drop policy "admin lit l activite" on public.activite;

-- ═══════════════════════════════════════════════════════════════════════════
--  S-02 — Inventaire des policies restantes
--  À exécuter dans Supabase → SQL Editor. Lecture seule : ne modifie rien.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  S-04 a couvert `joueurs` et `codes`. Cinq tables n'ont jamais été auditées,
--  et le navigateur écrit directement dans trois d'entre elles :
--
--    parties     ← upsert de la progression        (index.html, syncToSupabase)
--    tentatives  ← insert à chaque réponse          (index.html, logTentative)
--    evenements  ← insert à chaque événement de jeu (index.html, logEvent)
--    jeux        ← lecture du jeu publié            (index.html, catalogue.html)
--    themes      ← lecture du thème                 (index.html, editeur, admin)
--
--  Ce qu'on cherche : une policy d'écriture sur `parties`, `tentatives` ou
--  `evenements` qui ne contraindrait pas la ligne au joueur connecté. Le même
--  défaut que « creer son profil », qui contrôlait `id` mais laissait `jeu_id`
--  libre — c'est ce qui permettait de s'inscrire sur n'importe quel jeu.
--  Ici, l'équivalent permettrait d'écraser la progression d'un autre joueur.
--
--  Sur `jeux`, l'enjeu est différent : la table contient les énigmes AVEC leurs
--  réponses. Vérifier que la lecture publique est bien restreinte aux jeux
--  publiés — et se rappeler qu'un joueur peut de toute façon lire les réponses
--  de SON jeu, le moteur les validant côté navigateur (constat S-08).


-- ── 1. Les policies ────────────────────────────────────────────────────────
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('parties', 'tentatives', 'evenements', 'jeux', 'themes')
order by tablename, cmd, policyname;


-- ── 2. RLS est-elle seulement active ? ─────────────────────────────────────
-- Une table avec relrowsecurity = false est entièrement ouverte, quelles que
-- soient ses policies : elles ne s'appliquent tout simplement pas.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('parties', 'tentatives', 'evenements', 'jeux', 'themes');


-- ── 3. Contraintes d'unicité sur parties ───────────────────────────────────
-- syncToSupabase() fait un upsert sur (joueur_id, jeu_id) : la contrainte doit
-- exister, sinon l'upsert crée des doublons au lieu de mettre à jour.
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.parties'::regclass;

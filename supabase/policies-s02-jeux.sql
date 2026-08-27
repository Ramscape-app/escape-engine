-- ═══════════════════════════════════════════════════════════════════════════
--  S-02 / S-01 — Fermer la lecture des énigmes par les anonymes
--  À exécuter dans Supabase → SQL Editor, APRÈS avoir déployé le code.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  La table `jeux` contient la colonne `enigmas` : les énigmes AVEC leurs
--  réponses. Elle était lisible par le rôle `public`, qui inclut `anon` :
--
--    jeux | jeux publies lisibles par tous | SELECT | {public} | (statut = 'publie')
--
--  Avec la clé publiable présente en clair dans le source des pages, n'importe
--  qui pouvait donc extraire toutes les réponses de tous les jeux publiés, sans
--  compte et sans code d'invitation.
--
--  À distinguer de S-08 : qu'un joueur puisse lire les réponses de SON jeu est
--  inhérent au moteur, qui valide côté navigateur. Que le monde entier lise
--  TOUS les jeux ne l'est pas.
--
--  ⚠️ Le code doit être déployé d'abord. `catalogue.html` et l'aperçu du nom
--     dans `rejoindre.html?slug=` lisaient cette table anonymement ; ils passent
--     désormais par la fonction `jeux-publics`, qui ne renvoie que le nom, le
--     client et la version. Une page encore en cache échouerait sinon.


-- ── Remplacement de la policy ──────────────────────────────────────────────

drop policy "jeux publies lisibles par tous" on public.jeux;

-- Un joueur connecté ne voit plus que le jeu auquel il est inscrit.
-- La sous-requête sur `joueurs` s'exécute avec les droits de l'appelant : la
-- policy « lire son profil » (auth.uid() = id) s'y applique, et `joueurs` ne
-- référence pas `jeux`, donc aucune récursion.
create policy "lire le jeu auquel on est inscrit" on public.jeux
  for select to authenticated
  using (
    statut = 'publie'
    and exists (
      select 1 from public.joueurs j
      where j.id = auth.uid() and j.jeu_id = jeux.id
    )
  );

-- `anon` n'a plus aucune policy sur `jeux` : plus aucune lecture anonyme.


-- ── Ce qui continue de fonctionner ─────────────────────────────────────────
--
--  index.html  · loadFromSupabase() lit le jeu APRÈS authGuard(), qui a déjà
--                vérifié l'inscription — la policy le laisse donc passer
--  catalogue   · via la fonction jeux-publics (clé de service, hors RLS)
--  rejoindre   · aperçu du nom via la même fonction
--  admin/éditeur · via jeu-get, jeux-list (clé de service, hors RLS)
--  themes      · policy inchangée, `using (true)` : couleurs et polices


-- ── Retour arrière, si jamais ──────────────────────────────────────────────
--
-- drop policy "lire le jeu auquel on est inscrit" on public.jeux;
-- create policy "jeux publies lisibles par tous" on public.jeux
--   for select to public using (statut = 'publie'::text);
--
-- Rétablir l'ancienne policy réexpose toutes les réponses : dépannage seulement.


-- ── Vérification ───────────────────────────────────────────────────────────
--
--  1. Un joueur connecté recharge sa partie → doit fonctionner
--  2. Le catalogue s'affiche toujours (il ne passe plus par RLS)
--  3. rejoindre.html?slug=<un slug publié> affiche bien le nom du jeu
--  4. Déconnecté, dans la console du navigateur :
--       await sb.from('jeux').select('slug,name')   → 0 ligne
--
--  Le point 1 est le plus important : s'il échoue, exécuter le retour arrière.


-- ── Reste ouvert sur S-02 ──────────────────────────────────────────────────
--  Rien ne contraint `jeu_id` dans `parties`, `tentatives` et `evenements` :
--  un joueur peut rattacher SA ligne à un autre jeu. Aucun accès n'est gagné
--  (authGuard se fie à `joueurs.jeu_id`), seules les statistiques sont polluées.
--  Non traité : le correctif demanderait une contrainte croisée avec `joueurs`.

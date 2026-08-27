-- ═══════════════════════════════════════════════════════════════════════════
--  S-04 — Fermer l'inscription directe depuis le navigateur
--  ✅ APPLIQUÉ ET VÉRIFIÉ le 27/08/2026. Ce fichier est le compte rendu de ce
--     qui a été fait ; il n'y a rien à ré-exécuter.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Le navigateur lisait la table `codes` avec la clé publique, puis créait
--  lui-même compte et profil avec le jeu_id qu'il venait de lire. Le code
--  d'invitation n'était donc jamais vérifié côté serveur.
--
--  Le code applicatif (fonctions `rejoindre` et `code-resolve`) sécurise le
--  parcours normal ; ce sont ces policies qui ferment le contournement.


-- ── Constaté avant intervention ────────────────────────────────────────────
--
--  tablename | policyname              | cmd    | roles    | qual              | with_check
--  ----------+-------------------------+--------+----------+-------------------+--------------------
--  codes     | verifier un code actif  | SELECT | {public} | (actif = true)    |
--  joueurs   | creer son profil        | INSERT | {public} |                   | (auth.uid() = id)
--  joueurs   | lire son profil         | SELECT | {public} | (auth.uid() = id) |
--
--  `public` couvre `anon` et `authenticated` : n'importe qui pouvait donc lire
--  la totalité des codes actifs. Et le contrôle de « creer son profil » ne
--  portait que sur `id` — rien ne contraignait `jeu_id`, d'où le bypass.


-- ── Exécuté ────────────────────────────────────────────────────────────────

-- codes : plus aucune lecture depuis le navigateur.
-- RLS active sans aucune policy = tout est refusé aux clés publiques, ce qui
-- est exactement l'effet recherché. Seules les fonctions serveur (clé de
-- service, qui contourne RLS) y accèdent désormais.
alter table public.codes enable row level security;
drop policy "verifier un code actif" on public.codes;

-- joueurs : plus d'insertion depuis le navigateur. Le profil est créé
-- uniquement par rejoindre.js et joueur-create.js.
alter table public.joueurs enable row level security;
drop policy "creer son profil" on public.joueurs;

-- ⚠️ « lire son profil » est CONSERVÉE. authGuard() (public/index.html) lit
--    `joueurs` pour vérifier l'accès au jeu : sans elle, plus personne ne peut
--    jouer. C'est le seul faux pas vraiment dangereux de cette intervention.


-- ── État vérifié après intervention ────────────────────────────────────────
--
--  pg_policies  → une seule ligne : joueurs / « lire son profil » / SELECT
--  pg_class     → relrowsecurity = true sur `codes` ET sur `joueurs`
--
--  Les deux comptent : « zéro policy » ne ferme la table que si RLS est active.
--
--  Testé en production : connexion d'un compte existant, création d'un compte
--  neuf avec un code valide, et accès au jeu. Les trois parcours passent.


-- ── Retour arrière, si jamais ──────────────────────────────────────────────
--
-- create policy "verifier un code actif" on public.codes
--   for select to public using (actif = true);
--
-- create policy "creer son profil" on public.joueurs
--   for insert to public with check (auth.uid() = id);
--
-- Rétablir ces deux policies rouvre la faille : à ne faire que pour dépanner.


-- ── Console Supabase (hors SQL) ────────────────────────────────────────────
-- Authentication → Sign In / Providers → Email : « Allow new users to sign up »
-- décoché. Le navigateur n'appelle plus signUp() ; seules les fonctions serveur
-- créent des comptes.


-- ── Reste ouvert ───────────────────────────────────────────────────────────
-- Ce fichier ne couvre que `joueurs` et `codes`. Les policies de `parties`,
-- `tentatives`, `evenements`, `jeux` et `themes` n'ont pas été revues
-- (constat S-02) : le navigateur y écrit toujours directement.
-- Voir supabase/diagnostic-s02.sql pour l'inventaire à faire.

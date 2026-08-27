-- ═══════════════════════════════════════════════════════════════════════════
--  S-04 — Fermer l'inscription directe depuis le navigateur
--  À exécuter dans Supabase → SQL Editor, APRÈS avoir déployé le code.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  Sans ce script, les fonctions serveur `rejoindre` et `code-resolve` existent
--  mais ne protègent rien : l'ancien chemin (lire `codes`, insérer dans `joueurs`
--  avec la clé publique) reste ouvert à qui appelle l'API directement.
--
--  ⚠️ NE PAS exécuter d'un bloc. Lire l'étape 1, puis adapter les étapes 2 et 3
--     aux noms de policies réellement présents dans ton projet.
--
--  ⚠️ Ordre impératif : déployer le code d'abord. Une page rejoindre.html encore
--     en cache chez un visiteur utiliserait l'ancien chemin, qui échouerait dès
--     que ces policies sont appliquées.


-- ── ÉTAPE 1 · Inspection ───────────────────────────────────────────────────
-- Les noms de policies ne sont pas dans le dépôt (constat S-02). Il faut les
-- lire avant de toucher à quoi que ce soit. Note le résultat quelque part :
-- c'est aussi ta seule sauvegarde en cas de retour arrière.

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('joueurs', 'codes')
order by tablename, cmd, policyname;


-- ── ÉTAPE 2 · `codes` : plus aucun accès depuis le navigateur ──────────────
-- La table était lisible par la clé publique : l'ensemble des codes
-- d'invitation était énumérable en une requête. Seules les fonctions serveur
-- (clé de service, qui contourne RLS) doivent y accéder désormais.

alter table public.codes enable row level security;

-- Reprendre chaque policy listée à l'étape 1 pour `codes` dont `roles` contient
-- `anon` ou `authenticated`, et la supprimer :
-- drop policy "<nom relevé à l'étape 1>" on public.codes;

-- Aucune policy n'est recréée : RLS activée sans policy = tout est refusé aux
-- clés publiques, ce qui est exactement l'effet recherché.


-- ── ÉTAPE 3 · `joueurs` : plus d'insertion depuis le navigateur ────────────
-- Le profil est désormais créé uniquement par `rejoindre.js` et `joueur-create.js`.

alter table public.joueurs enable row level security;

-- Supprimer UNIQUEMENT la ou les policies dont `cmd` vaut INSERT (ou ALL) et
-- dont `roles` contient `anon` ou `authenticated` :
-- drop policy "<nom relevé à l'étape 1>" on public.joueurs;

-- ⚠️⚠️ NE PAS SUPPRIMER la policy de LECTURE de sa propre ligne.
-- authGuard() (public/index.html) lit `joueurs` pour vérifier que le joueur a
-- accès au jeu : sans cette policy, PLUS PERSONNE ne peut jouer.
-- Si elle n'existe pas sous cette forme, la (re)créer :

-- create policy "joueur lit son propre profil"
--   on public.joueurs for select
--   to authenticated
--   using (id = auth.uid());


-- ── ÉTAPE 4 · Console Supabase (hors SQL) ──────────────────────────────────
-- Authentication → Sign In / Providers → Email :
--   décocher « Allow new users to sign up ».
-- Le navigateur n'appelle plus signUp() : seules les fonctions serveur créent
-- des comptes. Cela empêche la création de comptes sans code d'invitation.


-- ── ÉTAPE 5 · Vérification ─────────────────────────────────────────────────
-- Depuis la console du navigateur, sur le site déployé et connecté en joueur :
--
--   await sb.from('joueurs').select('*')      -- doit renvoyer SA ligne, et elle seule
--   await sb.from('codes').select('*')        -- doit renvoyer 0 ligne ou une erreur
--   await sb.from('joueurs').insert({ pseudo: 'x' })   -- doit être rejeté
--
-- Puis, dans cet ordre :
--   1. recharger une partie en cours  → doit fonctionner (sinon l'étape 3 a
--      supprimé la policy de lecture : la recréer immédiatement)
--   2. s'inscrire avec un code valide → doit fonctionner
--   3. se connecter avec un compte existant → doit fonctionner


-- ── Reste ouvert ───────────────────────────────────────────────────────────
-- Ce fichier ne couvre que S-04. Les policies de `parties`, `tentatives`,
-- `evenements`, `jeux` et `themes` n'ont pas été revues (constat S-02) : le
-- navigateur y écrit toujours directement, et rien dans le dépôt ne permet de
-- vérifier ce qu'un joueur peut y faire.

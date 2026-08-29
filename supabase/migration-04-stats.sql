-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 4 — Agrégation des statistiques en SQL
--  À exécuter dans Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  stats.js chargeait `tentatives` et `evenements` en entier pour les agréger en
--  JavaScript. Ces deux tables grossissent à chaque geste de jeu, et PostgREST
--  plafonne les résultats : passé la limite, les chiffres se seraient mis à
--  mentir SANS erreur ni indication (constat R-03). Compter en SQL supprime le
--  problème par construction.
--
--  Ces fonctions sont appelées depuis les fonctions serveur avec la clé de
--  service, qui contourne RLS. Elles ne sont donc PAS `security definer` et
--  n'ouvrent aucun accès nouveau : un appel avec la clé publique resterait
--  soumis aux policies existantes.
--
--  ⚠️ Additif : uniquement des fonctions, aucune table ni colonne modifiée.


-- ── Échecs et réussites par énigme ─────────────────────────────────────────
-- Remplace le blocMap que stats.js calculait en parcourant toute la table.

create or replace function public.stats_tentatives()
returns table (jeu_id uuid, enigme_index int, echecs bigint, reussites bigint)
language sql stable as $$
  select t.jeu_id,
         t.enigme_index,
         count(*) filter (where not t.reussie) as echecs,
         count(*) filter (where t.reussie)     as reussites
  from public.tentatives t
  group by t.jeu_id, t.enigme_index
$$;


-- ── Les mauvaises réponses les plus fréquentes ─────────────────────────────
-- La colonne `reponse` était collectée depuis toujours et affichée nulle part.
-- « 12 joueurs ont répondu Zidane à l'énigme 4 » dit qu'un énoncé est ambigu
-- bien mieux qu'un taux d'échec.
--
-- Regroupement insensible à la casse et aux espaces, sinon « zidane » et
-- « Zidane  » compteraient pour deux réponses différentes.

create or replace function public.stats_mauvaises_reponses(p_limite int default 100)
returns table (jeu_id uuid, enigme_index int, reponse text, occurrences bigint)
language sql stable as $$
  select t.jeu_id,
         t.enigme_index,
         min(t.reponse) as reponse,          -- une graphie représentative
         count(*)       as occurrences
  from public.tentatives t
  where not t.reussie
    and t.reponse is not null
    and btrim(t.reponse) <> ''
  group by t.jeu_id, t.enigme_index, lower(btrim(t.reponse))
  order by count(*) desc
  limit p_limite
$$;


-- ── Événements : comptages par fenêtre ─────────────────────────────────────

create or replace function public.stats_evenements()
returns table (fins_30j bigint, debuts_30j bigint)
language sql stable as $$
  select count(*) filter (where e.type = 'fin'   and e.created_at >= now() - interval '30 days'),
         count(*) filter (where e.type = 'debut' and e.created_at >= now() - interval '30 days')
  from public.evenements e
$$;


-- ── Vérification ───────────────────────────────────────────────────────────
--
--  select * from public.stats_mauvaises_reponses(20);
--  select sum(echecs + reussites) from public.stats_tentatives();
--    → doit être égal à : select count(*) from public.tentatives;
--      (c'est exactement ce que le balayage JavaScript ne garantissait plus)


-- ── Retour arrière ─────────────────────────────────────────────────────────
-- drop function if exists public.stats_tentatives();
-- drop function if exists public.stats_mauvaises_reponses(int);
-- drop function if exists public.stats_evenements();

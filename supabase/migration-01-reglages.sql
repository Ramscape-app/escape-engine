-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · phase 1 — Réglages de jeu (chrono)
--  À exécuter dans Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ⚠️ `main` et `evolution` partagent la même base. Cette migration est donc
--     strictement ADDITIVE : une colonne nullable avec valeur par défaut.
--     Le moteur déployé sur `main` ignore ce qu'il ne connaît pas et continue
--     de fonctionner sans rien voir.

alter table public.jeux
  add column if not exists reglages jsonb not null default '{}'::jsonb;

comment on column public.jeux.reglages is
  'Réglages de jeu, libres. Aujourd''hui : { "dureeMinutes": 60 } pour le chrono.';

-- Aucune policy à ajouter : la colonne suit celles de `jeux`, déjà restreintes
-- au jeu auquel le joueur est inscrit (voir policies-s02-jeux.sql).

-- ── Retour arrière ─────────────────────────────────────────────────────────
-- alter table public.jeux drop column reglages;

-- ═══════════════════════════════════════════════════════════════════════════
--  Évolution · thèmes — profondeur du fond et caractère des titres
-- ═══════════════════════════════════════════════════════════════════════════
--
--  L'accent secondaire tient dans le jsonb `colors` existant, mais deux
--  réglages ont besoin de leur propre colonne.
--
--  ⚠️ Additif : deux colonnes nullables avec valeur par défaut. Les thèmes
--     existants gardent exactement leur rendu actuel, et `main` — qui ne lit
--     pas ces colonnes — continue de tourner sans les voir.

alter table public.themes
  add column if not exists ambiance text not null default 'discrete',
  add column if not exists titres jsonb not null default '{}'::jsonb;

comment on column public.themes.ambiance is
  'Profondeur du fond : aucune | discrete | marquee.';
comment on column public.themes.titres is
  'Caractere des titres : { "poids":700, "casse":"none|uppercase", "interlettrage":2 }.';

-- ── Retour arrière ─────────────────────────────────────────────────────────
-- alter table public.themes drop column ambiance, drop column titres;

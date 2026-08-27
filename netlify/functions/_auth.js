import { createClient } from '@supabase/supabase-js';

// Client "pleins pouvoirs" (clé secrète) — réutilisé par toutes les fonctions
export function adminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// Vérifie que l'appel vient bien d'un admin connecté.
// Renvoie { ok:true, user } si admin, sinon { ok:false, status, error }.
export async function requireAdmin(req) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Non authentifié' };

  const sb = adminClient();
  // 1) le jeton correspond-il à un utilisateur valide ?
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, error: 'Jeton invalide' };

  // 2) cet utilisateur est-il dans la table admins ?
  const { data: admin } = await sb.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!admin) return { ok: false, status: 403, error: 'Accès réservé aux administrateurs' };

  return { ok: true, user };
}

// ── Utilitaires partagés ──────────────────────────────────────────────

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

// Normalisation d'un code d'invitation. Identique à code-create.js, qui stocke
// les codes en majuscules : sans ce passage, un joueur qui tape son code en
// minuscules ne trouve rien.
export function normaliserCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
}

// Adresse technique d'un joueur (les joueurs n'ont pas d'email réel).
//
// ⚠️ Cet algorithme définit l'identité des comptes existants : le modifier les
// rendrait tous inaccessibles. C'est pourquoi la collision « Jean-Luc » /
// « jean luc » / « JeanLuc » (constat F-06 de AUDIT.md) n'est pas corrigée ici :
// elle demande une migration des comptes déjà créés.
// synthEmail() dans public/rejoindre.html en est le miroir exact, nécessaire à la
// connexion — toute modification doit être faite des deux côtés en même temps.
export function emailJoueur(pseudo, slug) {
  const clean = String(pseudo || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean ? `${clean}@${slug}.joueurs.local` : null;
}

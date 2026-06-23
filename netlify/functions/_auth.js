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

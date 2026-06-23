import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const { count, error } = await sb
    .from('joueurs')
    .select('*', { count: 'exact', head: true });

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true, total_joueurs: count }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

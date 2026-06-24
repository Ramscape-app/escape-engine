import { createClient } from '@supabase/supabase-js';

const ASSET_BASE = "https://gpwdnflaxuuselxxkepn.supabase.co/storage/v1/object/public/assets/";
const asset = (p) => !p ? p : (/^https?:\/\//.test(p) ? p : ASSET_BASE + String(p).replace(/^\.?\//, ''));

export default async (req) => {
  const slug = new URL(req.url).searchParams.get('slug') || '';
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  let name = 'Escape Game', bg = '#0a0a0f';
  let icon192 = ASSET_BASE + 'icons/icon-192.png';
  let icon512 = ASSET_BASE + 'icons/icon-512.png';

  if (slug) {
    const { data } = await sb.from('jeux')
      .select('name, branding, theme:themes(colors)')
      .eq('slug', slug).maybeSingle();
    if (data) {
      name = data.name || name;
      const c = data.theme && data.theme.colors;
      if (c && c.bg) bg = c.bg;
      const b = data.branding || {};
      if (b.appIcon192) icon192 = asset(b.appIcon192);
      if (b.appIcon512) icon512 = asset(b.appIcon512);
    }
  }

  const manifest = {
    name,
    short_name: name.slice(0, 12),
    start_url: `/index.html?slug=${encodeURIComponent(slug)}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  });
};

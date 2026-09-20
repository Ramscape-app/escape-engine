import { createClient } from '@supabase/supabase-js';

// Le manifeste d'application, un par jeu.
//
// Il ne l'etait pas : la page appelait cette fonction sans parametre dans son
// `<link rel="manifest">`, et le parametre n'etait rajoute par un script du
// corps que pour un jeu publie ouvert avec `?slug=`. Un jeu ouvert en test
// (« Tester » dans la console → `?previewId=`) recevait donc toujours le meme
// manifeste : meme nom « Escape Game », meme icone generique, meme `start_url`.
// Or le navigateur identifie une application installee par ce manifeste. Deux
// jeux qui rendent le meme manifeste sont donc le MEME jeu pour le telephone :
// il n'en propose pas l'installation, puisqu'il l'a deja.
//
// D'ou les trois pieces ci-dessous : l'identite (`id`) est explicite et porte
// le jeu, le nom vient du jeu, et l'icone est la photo de la page d'intro
// (`branding.avatar`) — celle que l'organisateur a deja televersee.

const ASSET_BASE = "https://gpwdnflaxuuselxxkepn.supabase.co/storage/v1/object/public/assets/";
const asset = (p) => !p ? p : (/^https?:\/\//.test(p) ? p : ASSET_BASE + String(p).replace(/^\.?\//, ''));

// Une photo d'intro n'est pas forcement un PNG. Annoncer le mauvais type fait
// rejeter l'icone par le navigateur, qui retombe sur une lettre dans un rond.
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
};
export function typeImage(url) {
  const ext = String(url || '').split(/[?#]/)[0].split('.').pop().toLowerCase();
  return MIME[ext] || 'image/png';
}

const ICONE_DEFAUT = ASSET_BASE + 'icons/icon-512.png';

// Le manifeste, sans acces reseau : c'est la partie qu'on peut verifier.
//   parametre — { slug } ou { previewId }, tel que la page l'a transmis
//   jeu       — la ligne de `jeux`, ou null si introuvable
export function construireManifest(parametre, jeu) {
  const { slug = '', previewId = '' } = parametre || {};
  // Le jeu publie prime : un previewId n'a de sens que sans slug.
  const requete = slug ? 'slug=' + encodeURIComponent(slug)
    : previewId ? 'previewId=' + encodeURIComponent(previewId) : '';
  const depart = '/index.html' + (requete ? '?' + requete : '');

  const b = (jeu && jeu.branding) || {};
  let nom = (jeu && jeu.name) || 'Escape Game';
  // Un jeu ouvert en test s'installe a cote du jeu publie, pas a sa place.
  if (previewId && !slug) nom += ' (test)';

  const couleurs = (jeu && jeu.theme && jeu.theme.colors) || {};
  const fond = couleurs.bg || '#0a0a0f';

  // `appIcon*` reste un reglage expert : une icone dessinee exprès l'emporte
  // sur la photo. Aucun ecran ne l'ecrit aujourd'hui, donc en pratique c'est
  // bien la photo de la page d'intro qui sert d'icone.
  const source = asset(b.appIcon512 || b.appIcon192 || b.avatar) || ICONE_DEFAUT;
  const type = typeImage(source);
  // `purpose: 'any'` et non `maskable` : une photo n'a pas la marge de securite
  // qu'un masque Android rogne, elle serait coupee sur ses bords.
  const icons = [
    { src: source, sizes: '192x192', type, purpose: 'any' },
    { src: source, sizes: '512x512', type, purpose: 'any' },
  ];

  return {
    // `id` fige l'identite de l'application. Sans lui elle se deduit de
    // `start_url`, ce qui marche aussi — mais le rendre explicite evite qu'un
    // changement d'URL de depart fasse reinstaller tous les jeux a cote des
    // anciens.
    id: depart,
    name: nom,
    short_name: nom.slice(0, 12),
    start_url: depart,
    scope: '/',
    lang: 'fr',
    display: 'standalone',
    orientation: 'portrait',
    background_color: fond,
    theme_color: fond,
    icons,
  };
}

const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const slug = (params.get('slug') || '').trim();
  const previewId = (params.get('previewId') || '').trim();

  let jeu = null;
  if (slug || EST_UUID.test(previewId)) {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    // `branding` et `name` seulement — le manifeste n'expose rien de plus que
    // ce que la page d'accueil du jeu affiche deja.
    const q = sb.from('jeux').select('name, branding, theme:themes(*)');
    const { data } = slug
      ? await q.eq('slug', slug).eq('statut', 'publie').maybeSingle()
      // En test, le jeu est encore un brouillon : pas de filtre sur le statut.
      // L'identifiant est un UUID, delivre par la console a l'organisateur.
      : await q.eq('id', previewId).maybeSingle();
    jeu = data || null;
  }

  return new Response(JSON.stringify(construireManifest({ slug, previewId }, jeu)), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  });
};

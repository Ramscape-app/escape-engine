// La signature RAMSCAPE : ce que le joueur voit avant toute chose.
//
// Un fichier video aurait pese 4 a 10 Mo — soit un ecran noir de plusieurs
// secondes en 4G, juste avant le moment ou l'effet doit porter. Ici tout est
// dessine ET joue par le navigateur : ~24 Ko, pas un octet a telecharger.
//
// L'objet est une boite fermee qui s'ouvre. C'est le geste meme d'un escape
// game, et c'est un volume que l'oeil reconnait tout de suite — la version
// precedente empilait des dalles, celle d'avant dessinait des contours au
// trait. Six faces pleines, des aretes qui prennent la lumiere, et une lueur
// enfermee dedans qui ne se libere qu'a l'ouverture.
//
// Cinq actes, enchaines par une seule horloge :
//   1. ASSEMBLAGE  les six faces arrivent du lointain et se referment sur
//                  elles-memes. La boite existe, scellee.
//   2. OUVERTURE   les quatre cotes basculent vers l'exterieur sur leur arete
//                  basse, le couvercle s'echappe. La lumiere sort.
//   3. LES MOTS    PATIENCE, REFLEXION, MEMOIRE frappent au-dessus de la boite
//                  ouverte.
//   4. FERMETURE   tout claque d'un coup, la boite se rescelle.
//   5. REVELATION  elle s'effondre en un souffle qui ouvre sur RAMSCAPE.
//
// La musique est synthetisee ici, pas empruntee au jeu : une nappe grave, une
// montee, des impacts cales sur les actes et un accord final. Tout est
// programme d'avance sur l'horloge audio, donc cale a l'image pres — la ou des
// `setTimeout` auraient derive.
//
// Regle tenue d'un bout a l'autre : on n'anime que transform, opacity et
// filter. Jamais une largeur ni une position — ce sont elles qui font saccader
// un telephone, parce qu'elles forcent le navigateur a refaire sa mise en page
// a chaque image.

// ─────────────────────────── Ce qui se decide ───────────────────────────
// Separe du dessin pour etre verifiable sans navigateur.

// Six faces : une boite. Chacune est un calque composite sur le GPU.
export const FACES = ['avant', 'arriere', 'droite', 'gauche', 'haut', 'bas'];

// Les reperes de la sequence, en millisecondes depuis le premier geste.
// Ecrits ici et nulle part ailleurs : un acte qui glisse ne doit pas obliger a
// retrouver des rendez-vous disperses, ni a reaccorder la musique.
export const REPERES = {
  assemblage: 0,
  scellee: 2300,
  ouverture: 3300,
  mot1: 4900,
  mot2: 6100,
  mot3: 7300,
  fermeture: 8500,
  implosion: 9100,
  flash: 9400,
  nom: 9700,
  signature: 10800,
  sortie: 11800,
  fin: 12500,
};

// Le bouton « passer » n'apparait pas tout de suite : propose a la premiere
// seconde, il invite a ne pas regarder. Trop tard, il emprisonne.
export const DELAI_PASSER = 1800;

export function dureeTotale() { return REPERES.fin; }

// Construit la liste des rendez-vous, triee. Un seul chemin pour les poser,
// donc un seul chemin pour les annuler quand le joueur passe la sequence.
export function planSequence(actes) {
  return Object.entries(REPERES)
    .filter(([nom]) => typeof actes[nom] === 'function')
    .map(([nom, t]) => ({ nom, t, faire: actes[nom] }))
    .sort((a, b) => a.t - b.t);
}

// La sequence ne se joue qu'une fois par appareil et par jeu : la revoir a
// chaque rechargement la transformerait en peage. ?cine=1 la force (pour la
// montrer), ?cine=0 la coupe.
export function doitJouer({ actif = true, recherche = '', vue = false, mouvementReduit = false } = {}) {
  const q = new URLSearchParams(recherche);
  const force = q.get('cine');
  if (force === '1') return 'complete';
  if (force === '0') return 'non';
  if (!actif) return 'non';
  if (vue) return 'non';
  // Un joueur qui a demande moins d'animations dans son systeme ne veut pas
  // douze secondes de mouvement. Il a droit a la marque, en fondu.
  return mouvementReduit ? 'sobre' : 'complete';
}

export function cleMemoire(identifiantJeu) {
  return 'cine_vue_' + (identifiantJeu || 'defaut');
}

// Le nom se compose lettre a lettre. Decoupe en mots d'abord : une lettre est
// un bloc en ligne, et sans ce regroupement un mot se couperait en fin de ligne
// au milieu. Chaque mot rend la liste de ses lettres.
export function decouperNom(nom) {
  return String(nom || '').trim().split(/\s+/).filter(Boolean).map(mot => [...mot]);
}

// Le rang de chaque lettre dans le nom entier, pour que la cascade traverse les
// mots sans repartir de zero a chacun.
export function nombreDeLettres(nom) {
  return decouperNom(nom).reduce((n, mot) => n + mot.length, 0);
}

// D'ou vient chaque face avant de se refermer sur la boite. Deterministe — une
// sequence qui change a chaque lecture ne se regle pas.
export function dispersion(i, total) {
  // Un tour d'or : les angles ne se repetent jamais et se repartissent bien,
  // la ou un pas regulier ferait apparaitre des alignements.
  const a = i * 2.39996;
  return {
    x: Math.round(Math.cos(a) * 230),
    y: Math.round(Math.sin(a) * 260),
    z: -1100 - i * 90,
    rot: Math.round(Math.cos(a * 1.7) * 120),
  };
}

// ─────────────────────────── La musique ───────────────────────────
// Generique et non celle du jeu : c'est la marque qu'elle annonce. Tout est
// programme d'avance sur l'horloge audio — a la milliseconde, et sans qu'un
// onglet occupe ne fasse deriver quoi que ce soit.

const S = (ms) => ms / 1000;   // les reperes sont en ms, l'audio en secondes

function note(ctx, sortie, t, freq, duree, forme = 'sine', vol = 0.2) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = forme;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g); g.connect(sortie);
  o.start(t); o.stop(t + duree + 0.06);
  return o;
}

// Programme les douze secondes d'un coup. Rend de quoi tout couper net si le
// joueur passe la sequence.
export function composer(ctx, t0) {
  const maitre = ctx.createGain();
  maitre.gain.setValueAtTime(0.0001, t0);
  maitre.gain.exponentialRampToValueAtTime(0.5, t0 + 1.4);
  maitre.connect(ctx.destination);

  // La nappe : deux oscillateurs legerement desaccordes battent l'un contre
  // l'autre. C'est ce battement qui empeche le grave de sonner comme une
  // sirene immobile.
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.Q.value = 6;
  filtre.frequency.setValueAtTime(220, t0);
  filtre.frequency.exponentialRampToValueAtTime(1500, t0 + S(REPERES.ouverture) + 0.6);
  filtre.frequency.exponentialRampToValueAtTime(260, t0 + S(REPERES.fermeture));
  filtre.connect(maitre);

  const nappe = ctx.createGain();
  nappe.gain.setValueAtTime(0.22, t0);
  nappe.connect(filtre);
  const graves = [55, 55.4, 110].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t0);
    o.connect(nappe);
    o.start(t0);
    o.stop(t0 + S(REPERES.fin) + 1.2);
    return o;
  });

  // La montee de l'assemblage : les faces viennent de loin, le son les suit.
  const montee = ctx.createOscillator(), gm = ctx.createGain();
  montee.type = 'triangle';
  montee.frequency.setValueAtTime(70, t0);
  montee.frequency.exponentialRampToValueAtTime(1100, t0 + S(REPERES.scellee));
  gm.gain.setValueAtTime(0.0001, t0);
  gm.gain.exponentialRampToValueAtTime(0.12, t0 + S(REPERES.scellee) - 0.15);
  gm.gain.exponentialRampToValueAtTime(0.0001, t0 + S(REPERES.scellee) + 0.25);
  montee.connect(gm); gm.connect(maitre);
  montee.start(t0); montee.stop(t0 + S(REPERES.scellee) + 0.4);

  // Les impacts, cales sur les actes.
  const a = (ms) => t0 + S(ms);
  note(ctx, maitre, a(REPERES.scellee), 48, 1.1, 'sine', 0.55);       // la boite se ferme
  note(ctx, maitre, a(REPERES.scellee), 150, 0.35, 'square', 0.18);
  note(ctx, maitre, a(REPERES.ouverture), 330, 0.6, 'triangle', 0.2); // elle s'ouvre
  note(ctx, maitre, a(REPERES.ouverture) + 0.09, 494, 0.55, 'triangle', 0.16);
  note(ctx, maitre, a(REPERES.ouverture) + 0.18, 660, 0.7, 'sine', 0.14);
  note(ctx, maitre, a(REPERES.mot1), 392, 0.3, 'sine', 0.22);
  note(ctx, maitre, a(REPERES.mot2), 494, 0.3, 'sine', 0.22);
  note(ctx, maitre, a(REPERES.mot3), 587, 0.3, 'sine', 0.22);
  note(ctx, maitre, a(REPERES.fermeture), 60, 0.9, 'square', 0.5);    // elle claque
  note(ctx, maitre, a(REPERES.implosion), 220, 0.5, 'sawtooth', 0.22);
  note(ctx, maitre, a(REPERES.flash), 880, 0.5, 'sine', 0.2);
  note(ctx, maitre, a(REPERES.flash), 1320, 0.45, 'sine', 0.1);

  // L'accord de la marque : il tient jusqu'au fondu, et c'est lui qu'on garde
  // en tete.
  for (const [f, v] of [[110, 0.3], [220, 0.26], [277.2, 0.2], [329.6, 0.17], [440, 0.12]])
    note(ctx, maitre, a(REPERES.nom), f, 2.6, 'triangle', v);

  maitre.gain.setValueAtTime(0.5, a(REPERES.sortie));
  maitre.gain.exponentialRampToValueAtTime(0.0001, a(REPERES.fin) + 0.6);

  return {
    couper() {
      const t = ctx.currentTime;
      try {
        maitre.gain.cancelScheduledValues(t);
        maitre.gain.setValueAtTime(Math.max(maitre.gain.value, 0.0001), t);
        maitre.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        for (const o of graves) o.stop(t + 0.4);
      } catch (e) { /* le contexte est deja ferme */ }
    },
  };
}

// ─────────────────────────── Le dessin ───────────────────────────

const STYLE_ID = 'cine-style';

function feuille() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.cine {
  position: fixed; inset: 0; z-index: 9000;
  background: #05050a;
  overflow: hidden; touch-action: manipulation;
  display: grid; place-items: center;
  --cine-accent: var(--accent, #00f0ff);
  --c: 38vmin;
}
.cine, .cine * { -webkit-tap-highlight-color: transparent; }
.cine.sort { opacity: 0; transition: opacity .8s ease; }

/* Le fond n'est pas un noir plat : une nappe de couleur respire derriere la
   boite et lui donne un espace ou exister. */
.cine::before {
  content: ""; position: absolute; inset: -20%;
  background: radial-gradient(40% 30% at 50% 48%,
    color-mix(in srgb, var(--cine-accent) 15%, transparent) 0%,
    color-mix(in srgb, var(--cine-accent) 4%, transparent) 44%,
    transparent 72%);
  animation: cine-nappe 9s ease-in-out infinite;
  pointer-events: none;
}
@keyframes cine-nappe {
  0%, 100% { transform: scale(1);    opacity: .7; }
  50%      { transform: scale(1.2);  opacity: 1; }
}

.cine-scene {
  position: absolute; inset: 0; perspective: 1000px;
  display: grid; place-items: center; pointer-events: none;
}
.cine-scene > * { position: absolute; transform-style: preserve-3d; }

/* ── La boite ───────────────────────────────────────────────────────── */
.cine-boite {
  width: var(--c); height: var(--c);
  /* On regarde la boite d'au-dessus. Vue d'en dessous, on voyait a travers
     elle alors qu'elle est censee etre scellee — et c'est de toute facon
     l'angle sous lequel on ouvre une boite. */
  transform: rotateX(22deg) rotateY(-32deg);
  transition: transform 1.8s cubic-bezier(.3,.7,.2,1);
}
.cine-boite.tourne { animation: cine-tour 16s linear infinite; }
@keyframes cine-tour {
  from { transform: rotateX(22deg) rotateY(-32deg); }
  to   { transform: rotateX(22deg) rotateY(328deg); }
}

.cine-face {
  position: absolute; inset: 0;
  /* De la matiere : une face pleine qui prend la lumiere d'une arete et la
     perd a l'autre, avec un lisere clair sur le bord. C'est ce degrade, et
     non un contour, qui fait qu'on lit un volume. */
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--cine-accent) 96%, #fff) 0%,
      var(--cine-accent) 24%,
      color-mix(in srgb, var(--cine-accent) 60%, #000) 60%,
      color-mix(in srgb, var(--cine-accent) 28%, #000) 100%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--cine-accent) 80%, #fff),
    0 0 40px -14px var(--cine-accent);
  border-radius: 3px;
  filter: brightness(var(--lum));
  opacity: 0;
  /* Dispersees au depart : elles viennent de loin. */
  transform: translate3d(var(--x), var(--y), var(--z)) rotate3d(1, 1, 0, var(--rot)) scale(.5);
  transition: transform 1.9s cubic-bezier(.22,.9,.24,1), opacity 1s ease;
  will-change: transform, opacity;
}

/* Fermee : chaque face a sa place sur le cube. L'arete basse sert de
   charniere aux quatre cotes — ce sont elles qui basculeront. */
.cine-boite.scellee .cine-face { opacity: 1; }
.cine-boite.scellee .cine-face.avant   { transform: translateZ(calc(var(--c) / 2)); }
.cine-boite.scellee .cine-face.arriere { transform: rotateY(180deg) translateZ(calc(var(--c) / 2)); }
.cine-boite.scellee .cine-face.droite  { transform: rotateY(90deg)  translateZ(calc(var(--c) / 2)); }
.cine-boite.scellee .cine-face.gauche  { transform: rotateY(-90deg) translateZ(calc(var(--c) / 2)); }
.cine-boite.scellee .cine-face.haut    { transform: rotateX(90deg)  translateZ(calc(var(--c) / 2)); }
.cine-boite.scellee .cine-face.bas     { transform: rotateX(-90deg) translateZ(calc(var(--c) / 2)); }

.cine-face.avant, .cine-face.arriere,
.cine-face.droite, .cine-face.gauche { transform-origin: 50% 100%; }

/* Ouverte : les quatre cotes tombent vers l'exterieur sur leur arete basse, le
   couvercle s'echappe vers le haut, le fond reste. */
.cine-boite.ouverte .cine-face.avant   { transform: translateZ(calc(var(--c) / 2)) rotateX(104deg); }
.cine-boite.ouverte .cine-face.arriere { transform: rotateY(180deg) translateZ(calc(var(--c) / 2)) rotateX(104deg); }
.cine-boite.ouverte .cine-face.droite  { transform: rotateY(90deg)  translateZ(calc(var(--c) / 2)) rotateX(104deg); }
.cine-boite.ouverte .cine-face.gauche  { transform: rotateY(-90deg) translateZ(calc(var(--c) / 2)) rotateX(104deg); }
.cine-boite.ouverte .cine-face.haut    { transform: rotateX(90deg) translateZ(calc(var(--c) * 1.5)) scale(.9); opacity: .25; }
.cine-boite.ouverte .cine-face { transition-duration: 1.5s; }

/* Refermee : plus court, avec une courbe qui depasse puis revient — c'est ce
   depassement qui donne le claquement. */
.cine-boite.referme .cine-face {
  transition-duration: .4s;
  transition-timing-function: cubic-bezier(.2,1.7,.35,1);
}
.cine-boite.implose .cine-face {
  opacity: 0;
  transform: translate3d(0,0,0) scale(.02);
  transition-duration: .55s;
  transition-timing-function: cubic-bezier(.65,0,.9,.25);
}

/* La lueur enfermee dans la boite : on ne la voit qu'a l'ouverture. */
.cine-lueur {
  width: calc(var(--c) * .72); height: calc(var(--c) * .72);
  border-radius: 50%;
  background: radial-gradient(circle,
    #fff 0%, var(--cine-accent) 26%,
    color-mix(in srgb, var(--cine-accent) 40%, transparent) 54%,
    transparent 74%);
  opacity: 0; transform: scale(.2);
  transition: opacity .9s ease, transform 1.4s cubic-bezier(.2,.9,.2,1);
}
.cine-lueur.sort { opacity: .95; transform: scale(1.25); animation: cine-pouls 2.4s ease-in-out infinite; }
.cine-lueur.rentre { opacity: 0; transform: scale(.15); transition-duration: .4s; animation: none; }
@keyframes cine-pouls {
  0%, 100% { filter: brightness(1); }
  50%      { filter: brightness(1.35); }
}

/* ── Le souffle final ───────────────────────────────────────────────── */
.cine-coeur {
  width: 190px; height: 190px; border-radius: 50%;
  background: radial-gradient(circle,
    #fff 0%, var(--cine-accent) 17%,
    color-mix(in srgb, var(--cine-accent) 34%, transparent) 40%,
    transparent 70%);
  opacity: 0; transform: scale(0);
}
.cine-coeur.eclot { animation: cine-eclosion 1.4s cubic-bezier(.15,.85,.25,1) forwards; }
@keyframes cine-eclosion {
  0%   { opacity: 0;   transform: scale(.05); }
  16%  { opacity: 1;   transform: scale(1.1); }
  /* Le souffle s'efface avant que la marque finisse de se composer : il doit
     la reveler, pas rester derriere elle. */
  55%  { opacity: .32; transform: scale(4.5); }
  100% { opacity: 0;   transform: scale(9); }
}

/* ── Les textes ─────────────────────────────────────────────────────── */
.cine-texte {
  position: relative; z-index: 2; text-align: center;
  padding: 0 24px; pointer-events: none; width: 100%;
}
/* Le voile sombre sous le texte n'existe QUE quand un texte est a l'ecran.
   Laisse en permanence, il posait une ombre immobile au milieu de l'image
   pendant toute l'animation. */
.cine-texte::before {
  content: ""; position: absolute; z-index: -1;
  left: -10%; right: -10%; top: -120%; bottom: -120%;
  background: radial-gradient(58% 30% at 50% 50%,
    rgba(0,0,0,.9) 0%, rgba(0,0,0,.74) 45%, transparent 78%);
  opacity: 0; transition: opacity .55s ease;
}
.cine.avec-texte .cine-texte::before { opacity: 1; }
.cine-mot {
  position: absolute; left: 0; right: 0;
  font-family: var(--font-display, system-ui), sans-serif;
  font-weight: 900; font-size: clamp(1.35rem, 8vw, 2.8rem);
  color: #fff; letter-spacing: .18em; opacity: 0;
  text-shadow: 0 0 18px var(--cine-accent), 0 2px 10px rgba(0,0,0,.65);
}
.cine-mot.entre { animation: cine-frappe 1.5s cubic-bezier(.16,1,.3,1) both; }
@keyframes cine-frappe {
  0%   { opacity: 0; letter-spacing: .9em; transform: scale(1.45); filter: blur(16px); }
  /* Le flou est redeclare a la fin du palier : sans cette etape, le navigateur
     interpole d'un bout a l'autre et le mot n'est jamais net. */
  26%  { opacity: 1; letter-spacing: .18em; transform: scale(1); filter: blur(0); }
  74%  { opacity: 1; letter-spacing: .18em; transform: scale(1); filter: blur(0); }
  100% { opacity: 0; letter-spacing: .05em; transform: scale(.94); filter: blur(6px); }
}
.cine-nom {
  font-family: var(--font-display, system-ui), sans-serif;
  font-weight: 900; font-size: clamp(1.7rem, 11vw, 3.4rem);
  color: #fff; letter-spacing: .14em; line-height: 1.2;
  text-shadow: 0 0 46px var(--cine-accent);
}
/* Un mot ne se coupe pas : ses lettres sont des blocs en ligne, et sans ce
   regroupement la fin de ligne tomberait au milieu d'un mot. */
.cine-nom-mot { display: inline-block; white-space: nowrap; }
.cine-nom span { display: inline-block; opacity: 0; }
.cine-nom span.entre { animation: cine-lettre .9s cubic-bezier(.16,1,.3,1) both; }
@keyframes cine-lettre {
  from { opacity: 0; transform: translateY(.35em) scale(1.25); filter: blur(10px); }
  to   { opacity: 1; transform: translateY(0) scale(1);        filter: blur(0); }
}
.cine-signature {
  margin-top: 22px;
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: clamp(.52rem, 2.6vw, .68rem);
  letter-spacing: .34em; color: var(--cine-accent);
  opacity: 0; transition: opacity 1.1s ease;
}
.cine-signature.entre { opacity: .85; }

/* ── La porte : le geste qui debloque le son ────────────────────────── */
.cine-porte {
  position: absolute; inset: 0; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 26px; padding: 24px; text-align: center; cursor: pointer;
  animation: cine-apparait 1.2s ease both;
}
.cine-porte.part { opacity: 0; transition: opacity .5s ease; pointer-events: none; }
@keyframes cine-apparait { from { opacity: 0; } to { opacity: 1; } }
.cine-porte-nom {
  font-family: var(--font-display, system-ui), sans-serif;
  font-weight: 900; font-size: clamp(1rem, 5.5vw, 1.7rem);
  letter-spacing: .34em; color: #fff; opacity: .42;
}
.cine-anneau {
  width: 96px; height: 96px; border-radius: 50%;
  background: radial-gradient(circle,
    color-mix(in srgb, var(--cine-accent) 60%, #fff) 0%,
    var(--cine-accent) 26%,
    color-mix(in srgb, var(--cine-accent) 22%, transparent) 54%,
    transparent 72%);
  animation: cine-battement 2.6s ease-in-out infinite;
}
@keyframes cine-battement {
  0%, 100% { transform: scale(.82); opacity: .75; }
  50%      { transform: scale(1);   opacity: 1; }
}
.cine-porte-invite {
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: clamp(.6rem, 3vw, .75rem);
  letter-spacing: .3em; color: var(--cine-accent);
  animation: cine-pulse-texte 2.6s ease-in-out infinite;
}
@keyframes cine-pulse-texte { 0%,100% { opacity: .55; } 50% { opacity: 1; } }

/* ── Passer ─────────────────────────────────────────────────────────── */
.cine-passer {
  position: absolute; z-index: 4;
  bottom: max(22px, env(safe-area-inset-bottom)); right: 20px;
  background: none; border: 1px solid color-mix(in srgb, #fff 22%, transparent);
  color: color-mix(in srgb, #fff 65%, transparent);
  border-radius: 999px; padding: 9px 16px; cursor: pointer;
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: .6rem; letter-spacing: .22em;
  opacity: 0; transition: opacity .6s ease;
}
.cine-passer.entre { opacity: 1; }

/* Un joueur qui a demande moins de mouvement recoit la marque, sans le reste. */
@media (prefers-reduced-motion: reduce) {
  .cine::before, .cine-anneau, .cine-porte-invite, .cine-lueur { animation: none; }
  .cine-boite, .cine-face { transition: none; }
}
`;
  document.head.appendChild(s);
}

const elt = (classe, parent, style) => {
  const e = document.createElement('div');
  e.className = classe;
  if (style) e.setAttribute('style', style);
  if (parent) parent.appendChild(e);
  return e;
};

// Joue la sequence. Rend une promesse resolue quand elle est finie, passee ou
// refusee — l'appelant enchaine sur le briefing sans avoir a savoir laquelle.
//
//   nom        la marque revelee a la fin (RAMSCAPE)
//   mots       les trois qualites annoncees
//   signature  la ligne sous la marque
//   invite     le texte de la porte
//   mode       'complete' | 'sobre'
export function jouer(options = {}) {
  const o = options || {};
  feuille();

  const racine = elt('cine');
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-label', "Séquence d'ouverture");
  document.body.appendChild(racine);

  const scene = elt('cine-scene', racine);
  const lueur = elt('cine-lueur', scene);
  const boite = elt('cine-boite', scene);
  const coeur = elt('cine-coeur', scene);
  const texte = elt('cine-texte', racine);

  FACES.forEach((f, i) => {
    const d = dispersion(i, FACES.length);
    // Le haut capte la lumiere, le bas est dans l'ombre : c'est ce qui donne
    // son volume a un cube dont toutes les faces seraient autrement jumelles.
    const lum = { haut: 1.1, avant: .95, droite: .8, gauche: .68, arriere: .6, bas: .5 }[f];
    elt('cine-face ' + f, boite,
      `--lum:${lum};--x:${d.x}px;--y:${d.y}px;--z:${d.z}px;--rot:${d.rot}deg;`);
  });

  const mots = (Array.isArray(o.mots) ? o.mots : []).slice(0, 3);
  const nodesMots = mots.map(m => {
    const e = elt('cine-mot', texte);
    e.textContent = m;
    return e;
  });

  const enTete = elt('cine-nom-bloc', texte);
  const nom = elt('cine-nom', enTete);
  const lettres = [];
  decouperNom(o.nom).forEach((mot, iMot) => {
    if (iMot) nom.appendChild(document.createTextNode(' '));
    const groupe = elt('cine-nom-mot', nom);
    for (const c of mot) {
      const s = document.createElement('span');
      s.textContent = c;
      groupe.appendChild(s);
      lettres.push(s);
    }
  });
  const signature = elt('cine-signature', enTete);
  signature.textContent = o.signature || '';

  // La porte. Elle existe pour une raison technique autant que dramatique :
  // aucun navigateur mobile ne laisse demarrer un son sans un geste.
  const porte = elt('cine-porte', racine);
  const porteNom = elt('cine-porte-nom', porte);
  porteNom.textContent = o.nom || '';
  elt('cine-anneau', porte);
  const invite = elt('cine-porte-invite', porte);
  invite.textContent = o.invite || 'TOUCHEZ POUR COMMENCER';

  const passer = document.createElement('button');
  passer.className = 'cine-passer';
  passer.type = 'button';
  passer.textContent = 'PASSER ›';
  racine.appendChild(passer);

  let horloges = [];
  let fini = false;
  let musique = null, ctxAudio = null;
  const plus = (ms, fn) => horloges.push(setTimeout(fn, ms));

  return new Promise((resoudre) => {
    const terminer = () => {
      if (fini) return;
      fini = true;
      horloges.forEach(clearTimeout);
      horloges = [];
      if (musique) musique.couper();
      racine.classList.add('sort');
      // On attend la fin du fondu avant de retirer : sinon le briefing
      // apparaitrait d'un coup, en pleine lumiere.
      setTimeout(() => {
        racine.remove();
        if (ctxAudio) { try { ctxAudio.close(); } catch (e) {} }
        resoudre();
      }, 820);
    };
    passer.addEventListener('click', (e) => { e.stopPropagation(); terminer(); });

    const demarrer = () => {
      porte.classList.add('part');
      plus(500, () => porte.remove());
      if (typeof o.surDepart === 'function') o.surDepart();

      // La musique part avec le geste et se programme d'un bloc : elle ne
      // peut plus se desynchroniser de l'image.
      try {
        ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
        musique = composer(ctxAudio, ctxAudio.currentTime + 0.05);
      } catch (e) { /* pas de son : la sequence se joue quand meme */ }

      if (o.mode === 'sobre') {
        racine.classList.add('avec-texte');
        lettres.forEach(s => s.classList.add('entre'));
        signature.classList.add('entre');
        plus(2600, terminer);
        return;
      }

      const actes = {
        assemblage: () => {
          // Deux images d'ecart : le navigateur doit avoir pose l'etat
          // disperse avant qu'on bascule, sinon il n'y a pas de transition,
          // seulement un saut.
          requestAnimationFrame(() => requestAnimationFrame(() =>
            boite.classList.add('scellee')));
        },
        scellee: () => boite.classList.add('tourne'),
        ouverture: () => {
          boite.classList.add('ouverte');
          lueur.classList.add('sort');
        },
        mot1: () => {
          racine.classList.add('avec-texte');
          nodesMots[0] && nodesMots[0].classList.add('entre');
        },
        mot2: () => nodesMots[1] && nodesMots[1].classList.add('entre'),
        mot3: () => nodesMots[2] && nodesMots[2].classList.add('entre'),
        fermeture: () => {
          racine.classList.remove('avec-texte');
          // L'ordre compte : la classe de retour doit etre posee AVANT que
          // celle de l'ouverture ne saute, sinon le retour emprunte la
          // transition lente de l'aller et le claquement disparait.
          boite.classList.add('referme');
          boite.classList.remove('ouverte');
          lueur.classList.add('rentre');
          lueur.classList.remove('sort');
        },
        implosion: () => {
          boite.classList.remove('tourne');
          boite.classList.add('implose');
        },
        flash: () => coeur.classList.add('eclot'),
        nom: () => {
          racine.classList.add('avec-texte');
          // Les lettres arrivent en cascade : 45 ms suffisent a lire une
          // composition plutot qu'un bloc qui surgit.
          lettres.forEach((s, i) => plus(i * 45, () => s.classList.add('entre')));
        },
        signature: () => signature.classList.add('entre'),
        sortie: () => { /* laisse respirer avant le fondu */ },
        fin: terminer,
      };

      for (const r of planSequence(actes)) plus(r.t, r.faire);
      plus(DELAI_PASSER, () => passer.classList.add('entre'));
    };

    porte.addEventListener('click', demarrer, { once: true });
    // Le bouton « passer » doit etre atteignable avant meme d'ouvrir la porte :
    // un joueur qui recommence une partie ne veut pas ce rideau.
    plus(DELAI_PASSER, () => passer.classList.add('entre'));
  });
}

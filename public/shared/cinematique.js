// La sequence d'ouverture : ce que le joueur voit avant toute chose.
//
// Un fichier video aurait pese 4 a 10 Mo — soit un ecran noir de plusieurs
// secondes en 4G, juste avant le moment ou l'effet doit porter — et aurait fige
// le nom, les couleurs et la photo pour tous les jeux. Ici tout est dessine par
// le navigateur : ~20 Ko, demarrage immediat, et chaque jeu recoit SA sequence
// puisqu'elle lit son nom, l'accent de son theme et sa photo d'intro.
//
// Quatre actes, enchaines par une seule horloge :
//   1. TUNNEL      des cadres embointes qui se precipitent vers l'oeil, chacun
//                  portant la photo du jeu : une image dans une image dans une
//                  image.
//   2. DECOMPOSITION  un objet geometrique s'ouvre en couches dans la
//                  profondeur, se maintient, puis se reassemble d'un coup.
//   3. MOTIF       l'objet tourne et se repete en rosace pendant que les trois
//                  mots frappent l'un apres l'autre.
//   4. REVELATION  tout s'effondre en un point de lumiere qui s'ouvre sur le
//                  nom du jeu.
//
// Regle tenue d'un bout a l'autre : on n'anime que `transform`, `opacity` et
// `filter`. Jamais une largeur, une hauteur ni une position — ce sont elles qui
// font saccader un telephone, parce qu'elles forcent le navigateur a recalculer
// la mise en page a chaque image.

// ─────────────────────────── Ce qui se decide ───────────────────────────
// Separe du dessin pour etre verifiable sans navigateur.

// Nombre d'elements animes. Chaque couche est un calque composite sur le GPU :
// genereux sur l'effet, mais un telephone d'entree de gamme en a assez de ca.
export const CADRES = 18;    // acte 1, les cadres du tunnel
export const TRANCHES = 16;  // acte 2, les couches de l'objet
export const PETALES = 12;   // acte 3, les branches de la rosace

// Les reperes de la sequence, en millisecondes depuis le premier geste.
// Ecrits ici et nulle part ailleurs : un acte qui glisse ne doit pas obliger a
// retrouver des `setTimeout` disperses.
export const REPERES = {
  tunnel: 0,
  eclatement: 2400,
  reassemblage: 4700,
  motif: 5200,
  mot1: 5500,
  mot2: 6600,
  mot3: 7700,
  implosion: 8900,
  flash: 9150,
  nom: 9450,
  signature: 10500,
  sortie: 11600,
  fin: 12300,
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
// chaque rechargement la transformerait en peage. `?cine=1` la force (pour la
// montrer), `?cine=0` la coupe.
export function doitJouer({ actif = true, recherche = '', vue = false, mouvementReduit = false } = {}) {
  const q = new URLSearchParams(recherche);
  const force = q.get('cine');
  if (force === '1') return 'complete';
  if (force === '0') return 'non';
  if (!actif) return 'non';
  if (vue) return 'non';
  // Un joueur qui a demande moins d'animations dans son systeme ne veut pas
  // treize secondes de mouvement. Il a droit au nom du jeu, en fondu.
  return mouvementReduit ? 'sobre' : 'complete';
}

export function cleMemoire(identifiantJeu) {
  return 'cine_vue_' + (identifiantJeu || 'defaut');
}

// Le nom se compose lettre a lettre. Decoupe en mots d'abord : une lettre est
// un bloc en ligne, et sans ce regroupement un mot se couperait en fin de ligne
// au milieu — « LES NO / CES ». Chaque mot rend la liste de ses lettres.
export function decouperNom(nom) {
  return String(nom || '').trim().split(/\s+/).filter(Boolean).map(mot => [...mot]);
}

// Le rang de chaque lettre dans le nom entier, pour que la cascade traverse les
// mots sans repartir de zero a chacun.
export function nombreDeLettres(nom) {
  return decouperNom(nom).reduce((n, mot) => n + mot.length, 0);
}

// ─────────────────────────── Le dessin ───────────────────────────

const STYLE_ID = 'cine-style';

function feuille() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.cine {
  position: fixed; inset: 0; z-index: 9000; background: #000;
  overflow: hidden; touch-action: manipulation;
  display: grid; place-items: center;
  /* L'accent du theme traverse toute la sequence ; la variable de repli
     permet de s'en passer si la page n'en definit pas. */
  --cine-accent: var(--accent, #00f0ff);
  --cine-objet: 60vmin;
}
.cine, .cine * { -webkit-tap-highlight-color: transparent; }
.cine.sort { opacity: 0; transition: opacity .8s ease; }

/* Toutes les couches 3D partagent la meme profondeur de champ. 900px : au-dela
   la perspective s'aplatit, en-dessous les bords se deforment trop. */
.cine-scene {
  position: absolute; inset: 0; perspective: 900px;
  display: grid; place-items: center; pointer-events: none;
}
.cine-scene > * { position: absolute; transform-style: preserve-3d; }

/* ── Acte 1 : le tunnel ─────────────────────────────────────────────── */
.cine-cadre {
  width: var(--cine-objet); height: var(--cine-objet);
  border: 1px solid var(--cine-accent);
  border-radius: 2px; opacity: 0;
  background-size: cover; background-position: center;
  box-shadow: 0 0 30px -10px var(--cine-accent);
  /* Une seule traversee par cadre : decales, ils font un flux continu qui
     s'eteint de lui-meme quand l'objet prend le relais. Boucler a l'infini
     obligerait a les arreter a la main et les laisserait courir derriere. */
  animation: cine-tunnel var(--d) linear 1;
  animation-delay: var(--t);
  will-change: transform, opacity;
}
/* Tant que la porte n'est pas ouverte, rien ne bouge : le tunnel derriere le
   nom et l'invitation brouillait la lecture des deux. */
.cine.attente .cine-cadre { animation-play-state: paused; }
.cine-cadre::after {
  /* La photo, posee dans chaque cadre : c'est elle qui fait « une image dans
     l'image » plutot qu'un simple couloir de rectangles. */
  content: ""; position: absolute; inset: 6%;
  background: inherit; background-size: cover; background-position: center;
  opacity: .5;
}
@keyframes cine-tunnel {
  /* Le cadre ne s'arrete pas devant l'oeil : il le traverse. A Z = 780 et une
     profondeur de champ de 900, il fait plus de six fois sa taille et sort de
     l'ecran par les bords — c'est ce depassement qui donne la chute en avant
     plutot qu'un couloir qu'on regarde de loin. */
  0%   { opacity: 0;   transform: translateZ(-2600px) rotate(var(--r)); }
  10%  { opacity: .95; }
  80%  { opacity: .8; }
  100% { opacity: 0;   transform: translateZ(780px) rotate(0deg); }
}

/* ── Actes 2 et 3 : l'objet en couches ──────────────────────────────── */
.cine-objet {
  width: var(--cine-objet); height: var(--cine-objet);
  opacity: 0;
  transform: rotateX(0deg) rotateZ(0deg);
  transition: opacity .7s ease, transform 1.5s cubic-bezier(.3,.7,.2,1);
}
.cine-objet.visible { opacity: 1; }
/* Ouvert : on bascule l'objet pour voir la tranche de ses couches. */
.cine-objet.eclate { transform: rotateX(64deg) rotateZ(-18deg); }
.cine-objet.tourne { animation: cine-rotation 14s linear infinite; }

.cine-tranche {
  position: absolute; inset: 0;
  border: 1px solid var(--cine-accent);
  border-radius: 1px;
  opacity: calc(.35 + var(--i) * .04);
  /* Assemble : les couches sont superposees et vrillees — un seul contour
     dense, dont on ne devine pas encore qu'il est fait de seize pieces. */
  transform: translateZ(0) rotateZ(calc(var(--i) * 11deg)) scale(calc(1 - var(--i) * .028));
  transition: transform 1.4s cubic-bezier(.3,.7,.2,1);
  will-change: transform;
}
/* Ouvert : chaque couche s'ecarte dans la profondeur, proportionnellement a son
   rang. C'est la vue eclatee. */
.cine-objet.eclate .cine-tranche {
  transform: translateZ(calc((var(--i) - 7.5) * 30px))
             rotateZ(calc(var(--i) * 11deg))
             scale(calc(1 - var(--i) * .028));
}
/* Referme : plus court, et une courbe qui depasse puis revient — c'est ce
   depassement qui donne le claquement. */
.cine-objet.reassemble .cine-tranche {
  transition-duration: .42s;
  transition-timing-function: cubic-bezier(.2,1.6,.35,1);
}
.cine-objet.implose .cine-tranche {
  transition-duration: .5s; transition-timing-function: cubic-bezier(.6,0,.9,.3);
  transform: translateZ(0) rotateZ(calc(var(--i) * 40deg)) scale(0);
}
@keyframes cine-rotation { to { transform: rotateZ(360deg); } }

/* ── Acte 3 : la rosace ─────────────────────────────────────────────── */
.cine-rosace { width: var(--cine-objet); height: var(--cine-objet); opacity: 0; transition: opacity 1s ease; }
.cine-rosace.visible { opacity: .55; }
.cine-petale {
  position: absolute; inset: 0; border: 1px solid var(--cine-accent);
  border-radius: 50% 50% 50% 0;
  transform: rotate(var(--a)) scale(.42);
  animation: cine-respire 3.4s ease-in-out infinite;
  animation-delay: var(--t);
  will-change: transform, opacity;
}
@keyframes cine-respire {
  0%, 100% { opacity: .18; }
  50%      { opacity: .7; }
}

/* ── Acte 4 : le point de lumiere ───────────────────────────────────── */
.cine-coeur {
  /* Un disque degrade, et non une pastille a grosse ombre portee : agrandie,
     l'ombre couvrait l'ecran d'un aplat uni qui noyait le nom. Le degrade,
     lui, se dilue en s'etendant. */
  width: 180px; height: 180px; border-radius: 50%;
  background: radial-gradient(circle,
    #fff 0%, var(--cine-accent) 18%,
    color-mix(in srgb, var(--cine-accent) 35%, transparent) 42%,
    transparent 70%);
  opacity: 0; transform: scale(0);
}
.cine-coeur.eclot { animation: cine-eclosion 1.4s cubic-bezier(.15,.85,.25,1) forwards; }
@keyframes cine-eclosion {
  0%   { opacity: 0;   transform: scale(.05); }
  16%  { opacity: 1;   transform: scale(1.1); }
  /* Le souffle s'efface avant que le nom finisse de se composer : il doit le
     reveler, pas rester derriere lui. */
  55%  { opacity: .35; transform: scale(4.5); }
  100% { opacity: 0;   transform: scale(9); }
}

/* ── Les textes ─────────────────────────────────────────────────────── */
.cine-texte {
  position: relative; z-index: 2; text-align: center;
  padding: 0 24px; pointer-events: none; width: 100%;
}
/* Un voile sombre sous le texte seulement. Sans lui, les mots tombaient au
   plus dense de la rosace et devenaient illisibles : du blanc sur un
   enchevetrement de traits clairs. Le motif reste visible tout autour. */
.cine-texte::before {
  content: ""; position: absolute; z-index: -1;
  left: -10%; right: -10%; top: -120%; bottom: -120%;
  background: radial-gradient(58% 32% at 50% 50%,
    rgba(0,0,0,.88) 0%, rgba(0,0,0,.72) 45%, transparent 78%);
}
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
  font-weight: 900; font-size: clamp(1.25rem, 6.6vw, 2.5rem);
  color: #fff; letter-spacing: .1em; line-height: 1.25;
  text-shadow: 0 0 50px var(--cine-accent);
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
  margin-top: 26px;
  font-family: var(--font-mono, ui-monospace), monospace;
  font-size: clamp(.55rem, 2.6vw, .7rem);
  letter-spacing: .32em; color: var(--cine-accent);
  opacity: 0; transition: opacity 1.1s ease;
}
.cine-signature.entre { opacity: .85; }

/* ── La porte : le geste qui debloque le son ────────────────────────── */
.cine-porte {
  position: absolute; inset: 0; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 26px; padding: 24px; text-align: center; cursor: pointer;
  background: radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--cine-accent) 7%, transparent), transparent 70%);
  animation: cine-apparait 1.2s ease both;
}
.cine-porte.part { opacity: 0; transition: opacity .5s ease; pointer-events: none; }
@keyframes cine-apparait { from { opacity: 0; } to { opacity: 1; } }
.cine-porte-nom {
  font-family: var(--font-display, system-ui), sans-serif;
  font-weight: 700; font-size: clamp(1rem, 5vw, 1.6rem);
  letter-spacing: .3em; color: #fff; opacity: .5;
}
.cine-anneau {
  width: 92px; height: 92px; border-radius: 50%;
  border: 1px solid var(--cine-accent);
  display: grid; place-items: center;
  animation: cine-battement 2.6s ease-in-out infinite;
}
.cine-anneau::before {
  content: ""; width: 10px; height: 10px; border-radius: 50%;
  background: var(--cine-accent); box-shadow: 0 0 24px 6px var(--cine-accent);
}
@keyframes cine-battement {
  0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 color-mix(in srgb, var(--cine-accent) 40%, transparent); }
  50%      { transform: scale(1.09); box-shadow: 0 0 0 22px transparent; }
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

/* Un joueur qui a demande moins de mouvement recoit le nom, sans le reste. */
@media (prefers-reduced-motion: reduce) {
  .cine-cadre, .cine-petale, .cine-anneau, .cine-porte-invite { animation: none; }
  .cine-objet, .cine-tranche { transition: none; }
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
//   nom        le nom du jeu
//   mots       les trois qualites annoncees
//   signature  la ligne sous le nom ({total} deja remplace)
//   invite     le texte de la porte
//   photo      URL de la photo d'intro, portee par les cadres du tunnel
//   ton        (freq, duree, forme) → joue un son ; optionnel
//   mode       'complete' | 'sobre'
export function jouer(options = {}) {
  const o = options || {};
  const ton = typeof o.ton === 'function' ? o.ton : () => {};
  feuille();

  const racine = elt('cine attente');
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-label', "Séquence d'ouverture");
  document.body.appendChild(racine);

  const scene = elt('cine-scene', racine);
  const rosace = elt('cine-rosace', scene);
  const objet = elt('cine-objet', scene);
  const coeur = elt('cine-coeur', scene);
  const texte = elt('cine-texte', racine);

  const fondPhoto = o.photo ? `background-image:url("${String(o.photo).replace(/"/g, '%22')}")` : '';
  // Les cadres sont poses directement dans la scene : seuls ses enfants directs
  // recoivent la perspective et le positionnement absolu. Glisses dans un
  // conteneur intermediaire, ils retombaient en colonne, a plat.
  const DUREE_CADRE = 2.2;
  for (let i = 0; i < CADRES; i++) {
    elt('cine-cadre', scene,
      `--t:${(i * (DUREE_CADRE / CADRES)).toFixed(2)}s;--d:${DUREE_CADRE}s;`
      + `--r:${(i % 2 ? 1 : -1) * (8 + i * 2)}deg;${fondPhoto}`);
  }
  for (let i = 0; i < TRANCHES; i++) elt('cine-tranche', objet, `--i:${i}`);
  for (let i = 0; i < PETALES; i++) {
    elt('cine-petale', rosace, `--a:${(i * 360 / PETALES).toFixed(1)}deg;--t:${(i * 0.17).toFixed(2)}s`);
  }

  const mots = (Array.isArray(o.mots) ? o.mots : []).slice(0, 3);
  const nodesMots = mots.map(m => {
    const e = elt('cine-mot', texte);
    e.textContent = m;
    return e;
  });

  const bloc = elt('cine-nom-bloc', texte);
  const nom = elt('cine-nom', bloc);
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
  const signature = elt('cine-signature', bloc);
  signature.textContent = o.signature || '';

  // La porte. Elle existe pour une raison technique autant que dramatique :
  // aucun navigateur mobile ne laisse demarrer un son sans un geste. Sans elle,
  // la sequence serait muette — et la musique du jeu le resterait aussi.
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
  const plus = (ms, fn) => horloges.push(setTimeout(fn, ms));

  return new Promise((resoudre) => {
    const terminer = () => {
      if (fini) return;
      fini = true;
      horloges.forEach(clearTimeout);
      horloges = [];
      racine.classList.add('sort');
      // On attend la fin du fondu avant de retirer : sinon le briefing
      // apparaitrait d'un coup, en pleine lumiere.
      setTimeout(() => { racine.remove(); resoudre(); }, 820);
    };
    passer.addEventListener('click', (e) => { e.stopPropagation(); terminer(); });

    const demarrer = () => {
      porte.classList.add('part');
      // Le tunnel attendait, en pause : il part avec le geste, pas avant.
      racine.classList.remove('attente');
      plus(500, () => porte.remove());
      if (typeof o.surDepart === 'function') o.surDepart();

      if (o.mode === 'sobre') {
        // Pas de mouvement : le nom, et c'est tout.
        lettres.forEach(s => s.classList.add('entre'));
        signature.classList.add('entre');
        plus(2600, terminer);
        return;
      }

      const actes = {
        tunnel: () => ton(110, .9, 'sine'),
        eclatement: () => {
          objet.classList.add('visible', 'eclate');
          ton(180, .5, 'triangle');
        },
        reassemblage: () => {
          // L'ordre compte : la classe de retour doit etre posee AVANT que
          // celle de l'ouverture ne saute, sinon le retour emprunte la
          // transition lente de l'aller et le claquement disparait.
          objet.classList.add('reassemble');
          objet.classList.remove('eclate');
          ton(70, .35, 'square');
          plus(420, () => ton(520, .18));
        },
        motif: () => { rosace.classList.add('visible'); objet.classList.add('tourne'); },
        mot1: () => { nodesMots[0] && nodesMots[0].classList.add('entre'); ton(392, .22); },
        mot2: () => { nodesMots[1] && nodesMots[1].classList.add('entre'); ton(494, .22); },
        mot3: () => { nodesMots[2] && nodesMots[2].classList.add('entre'); ton(587, .22); },
        implosion: () => {
          objet.classList.add('implose');
          rosace.classList.remove('visible');
          ton(90, .6, 'sawtooth');
        },
        flash: () => { coeur.classList.add('eclot'); ton(784, .5); },
        nom: () => {
          // Les lettres arrivent en cascade : 45 ms suffisent a lire une
          // composition plutot qu'un bloc qui surgit. Le souffle est deja en
          // train de se dissiper, il revele le nom au lieu de le couvrir.
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

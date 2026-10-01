// La signature RAMSCAPE : ce que le joueur voit avant toute chose.
//
// Un fichier video aurait pese 4 a 10 Mo — soit un ecran noir de plusieurs
// secondes en 4G, juste avant le moment ou l'effet doit porter. Ici tout est
// dessine par le navigateur : ~20 Ko et un demarrage immediat.
//
// Elle ne montre plus le jeu : elle montre la marque. Les cadres qui portaient
// la photo d'intro ont saute, et le nom revele est RAMSCAPE, le meme pour tous
// les jeux. Seule la couleur suit le theme, pour que l'enchainement sur le
// briefing ne fasse pas une rupture.
//
// Quatre actes, enchaines par une seule horloge :
//   1. ASSEMBLAGE    douze dalles pleines arrivent du lointain, floues et
//                    dispersees, et convergent en un bloc.
//   2. ECLATEMENT    le bloc s'ouvre en couches dans la profondeur, se
//                    maintient, puis se referme d'un coup.
//   3. LES MOTS      le bloc tourne sur lui-meme pendant que PATIENCE,
//                    REFLEXION et MEMOIRE frappent l'un apres l'autre.
//   4. REVELATION    le bloc s'effondre en un souffle de lumiere qui s'ouvre
//                    sur RAMSCAPE.
//
// De la matiere, pas du trait. Chaque dalle est une surface pleine, degradee
// du clair au sombre comme une face qui prend la lumiere, et assombrie selon
// son rang pour que l'empilement se lise comme une epaisseur. La version
// precedente etait faite de contours de 1 px : juste, mais c'etait un dessin
// technique, pas un objet.
//
// Regle tenue d'un bout a l'autre : on n'anime que transform, opacity et
// filter. Jamais une largeur ni une position — ce sont elles qui font saccader
// un telephone, parce qu'elles forcent le navigateur a refaire sa mise en page
// a chaque image.

// ─────────────────────────── Ce qui se decide ───────────────────────────
// Separe du dessin pour etre verifiable sans navigateur.

// Les dalles du bloc. Chacune est un calque composite sur le GPU : assez pour
// que l'empilement ait de l'epaisseur, pas au point de faire decrocher un
// telephone d'entree de gamme.
export const DALLES = 12;

// Les reperes de la sequence, en millisecondes depuis le premier geste.
// Ecrits ici et nulle part ailleurs : un acte qui glisse ne doit pas obliger a
// retrouver des setTimeout disperses.
export const REPERES = {
  assemblage: 0,
  bloc: 2400,
  eclatement: 3000,
  reassemblage: 4600,
  mot1: 5200,
  mot2: 6300,
  mot3: 7400,
  implosion: 8600,
  flash: 8900,
  nom: 9200,
  signature: 10300,
  sortie: 11300,
  fin: 12000,
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

// La position de depart de chaque dalle : dispersee dans toutes les
// directions, pour que la convergence se lise comme un rassemblement et non
// comme un simple fondu. Deterministe — une sequence qui change a chaque
// lecture ne se regle pas.
export function dispersion(i, total) {
  // Un tour d'or : les angles ne se repetent jamais et se repartissent bien,
  // la ou un pas regulier ferait apparaitre des alignements.
  const a = i * 2.39996;
  const loin = 1 - (i / total) * 0.45;
  return {
    x: Math.round(Math.cos(a) * 150 * loin),
    y: Math.round(Math.sin(a) * 190 * loin),
    z: -900 - i * 130,
    rot: Math.round(Math.cos(a * 1.7) * 70),
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
  --cine-bloc: 46vmin;
}
.cine, .cine * { -webkit-tap-highlight-color: transparent; }
.cine.sort { opacity: 0; transition: opacity .8s ease; }

/* Le fond n'est pas un noir plat : une nappe de couleur respire derriere le
   bloc et lui donne un espace ou exister. */
.cine::before {
  content: ""; position: absolute; inset: -20%;
  background: radial-gradient(42% 32% at 50% 48%,
    color-mix(in srgb, var(--cine-accent) 16%, transparent) 0%,
    color-mix(in srgb, var(--cine-accent) 5%, transparent) 42%,
    transparent 72%);
  animation: cine-nappe 9s ease-in-out infinite;
  pointer-events: none;
}
@keyframes cine-nappe {
  0%, 100% { transform: scale(1);    opacity: .75; }
  50%      { transform: scale(1.18); opacity: 1; }
}

/* 1100 px de profondeur de champ : au-dela la perspective s'aplatit, en-deca
   les bords se deforment. */
.cine-scene {
  position: absolute; inset: 0; perspective: 1100px;
  display: grid; place-items: center; pointer-events: none;
}
.cine-scene > * { position: absolute; transform-style: preserve-3d; }

/* ── Le bloc ────────────────────────────────────────────────────────── */
.cine-bloc {
  width: var(--cine-bloc); height: var(--cine-bloc);
  transform: rotateX(58deg) rotateZ(-22deg);
  transition: transform 1.6s cubic-bezier(.3,.7,.2,1);
}
.cine-bloc.droit  { transform: rotateX(16deg) rotateZ(0deg); }
.cine-bloc.ouvert { transform: rotateX(66deg) rotateZ(-26deg); }
.cine-bloc.tourne { animation: cine-rotation 13s linear infinite; }

.cine-dalle {
  position: absolute; inset: 0;
  border-radius: 4px;
  /* De la matiere : une face pleine qui prend la lumiere d'un bord et la
     perd a l'autre. C'est ce degrade, et non un contour, qui fait qu'on lit
     un volume plutot qu'un schema. */
  background: linear-gradient(142deg,
    color-mix(in srgb, var(--cine-accent) 96%, #fff) 0%,
    var(--cine-accent) 30%,
    color-mix(in srgb, var(--cine-accent) 64%, #000) 62%,
    color-mix(in srgb, var(--cine-accent) 34%, #000) 100%);
  box-shadow: 0 0 46px -16px var(--cine-accent);
  /* Plus la dalle est loin dans la pile, plus elle est sombre : c'est ce
     degrade d'ensemble qui donne son epaisseur a l'empilement. La pente reste
     douce — trop marquee, les dalles du milieu tombaient dans le noir et
     coupaient l'objet en deux. */
  filter: brightness(var(--lum));
  /* Dispersees au depart, invisibles et floues : elles viennent de loin. */
  opacity: 0;
  transform: translate3d(var(--x), var(--y), var(--z)) rotateZ(var(--rot)) scale(.6);
  transition: transform 1.9s cubic-bezier(.22,.9,.24,1),
              opacity 1.1s ease, filter .6s ease;
  will-change: transform, opacity;
}
/* Rassemblees : la pile, chaque dalle a son etage. */
.cine-bloc.assemble .cine-dalle {
  opacity: 1;
  transform: translate3d(0, 0, calc((var(--i) - 5.5) * 4px)) rotateZ(0deg) scale(1);
}
/* Ouvertes : la vue eclatee, chaque dalle ecartee selon son rang. */
.cine-bloc.eclate .cine-dalle {
  opacity: 1;
  transform: translate3d(0, 0, calc((var(--i) - 5.5) * 30px)) rotateZ(calc(var(--i) * 2deg)) scale(1);
  transition-duration: 1.25s;
}
/* Refermees : plus court, avec une courbe qui depasse puis revient — c'est ce
   depassement qui donne le claquement. */
.cine-bloc.referme .cine-dalle {
  transition-duration: .42s;
  transition-timing-function: cubic-bezier(.2,1.7,.35,1);
}
.cine-bloc.implose .cine-dalle {
  opacity: 0;
  transform: translate3d(0, 0, 0) rotateZ(calc(var(--i) * 26deg)) scale(.04);
  transition-duration: .55s;
  transition-timing-function: cubic-bezier(.65,0,.9,.25);
}
@keyframes cine-rotation { to { transform: rotateX(16deg) rotateZ(360deg); } }

/* ── Le souffle ─────────────────────────────────────────────────────── */
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
  /* Le souffle s'efface avant que le nom finisse de se composer : il doit le
     reveler, pas rester derriere lui. */
  55%  { opacity: .32; transform: scale(4.5); }
  100% { opacity: 0;   transform: scale(9); }
}

/* ── Les textes ─────────────────────────────────────────────────────── */
.cine-texte {
  position: relative; z-index: 2; text-align: center;
  padding: 0 24px; pointer-events: none; width: 100%;
}
/* Un voile sombre sous le texte seulement, sinon les mots tombent sur la
   matiere du bloc et deviennent illisibles. Le bloc reste visible autour. */
.cine-texte::before {
  content: ""; position: absolute; z-index: -1;
  left: -10%; right: -10%; top: -120%; bottom: -120%;
  background: radial-gradient(58% 30% at 50% 50%,
    rgba(0,0,0,.9) 0%, rgba(0,0,0,.74) 45%, transparent 78%);
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
  .cine::before, .cine-anneau, .cine-porte-invite { animation: none; }
  .cine-bloc, .cine-dalle { transition: none; }
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
//   ton        (freq, duree, forme) → joue un son ; optionnel
//   mode       'complete' | 'sobre'
export function jouer(options = {}) {
  const o = options || {};
  const ton = typeof o.ton === 'function' ? o.ton : () => {};
  feuille();

  const racine = elt('cine');
  racine.setAttribute('role', 'dialog');
  racine.setAttribute('aria-label', "Séquence d'ouverture");
  document.body.appendChild(racine);

  const scene = elt('cine-scene', racine);
  const bloc = elt('cine-bloc', scene);
  const coeur = elt('cine-coeur', scene);
  const texte = elt('cine-texte', racine);

  for (let i = 0; i < DALLES; i++) {
    const d = dispersion(i, DALLES);
    elt('cine-dalle', bloc,
      `--i:${i};--lum:${(1.02 - i * 0.034).toFixed(3)};`
      + `--x:${d.x}px;--y:${d.y}px;--z:${d.z}px;--rot:${d.rot}deg;`);
  }

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
      plus(500, () => porte.remove());
      if (typeof o.surDepart === 'function') o.surDepart();

      if (o.mode === 'sobre') {
        // Pas de mouvement : la marque, et c'est tout.
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
            bloc.classList.add('assemble')));
          ton(96, 1.1, 'sine');
        },
        bloc: () => { bloc.classList.add('droit'); ton(180, .45, 'triangle'); },
        eclatement: () => {
          bloc.classList.remove('droit');
          bloc.classList.add('ouvert', 'eclate');
          ton(220, .5, 'triangle');
        },
        reassemblage: () => {
          // L'ordre compte : la classe de retour doit etre posee AVANT que
          // celle de l'ouverture ne saute, sinon le retour emprunte la
          // transition lente de l'aller et le claquement disparait.
          bloc.classList.add('referme');
          bloc.classList.remove('eclate', 'ouvert');
          bloc.classList.add('droit');
          ton(70, .35, 'square');
          plus(420, () => { ton(520, .18); bloc.classList.add('tourne'); });
        },
        mot1: () => { nodesMots[0] && nodesMots[0].classList.add('entre'); ton(392, .22); },
        mot2: () => { nodesMots[1] && nodesMots[1].classList.add('entre'); ton(494, .22); },
        mot3: () => { nodesMots[2] && nodesMots[2].classList.add('entre'); ton(587, .22); },
        implosion: () => {
          bloc.classList.remove('tourne');
          bloc.classList.add('implose');
          ton(90, .6, 'sawtooth');
        },
        flash: () => { coeur.classList.add('eclot'); ton(784, .5); },
        nom: () => {
          // Les lettres arrivent en cascade : 45 ms suffisent a lire une
          // composition plutot qu'un bloc qui surgit. Le souffle est deja en
          // train de se dissiper, il revele la marque au lieu de la couvrir.
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

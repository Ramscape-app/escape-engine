// Apparence des pages d'administration : systeme, clair, sombre.
//
// Script CLASSIQUE et non module, volontairement : charge sans `defer` en tete
// de page, il s'execute avant le rendu. Un module est differe, et la page
// s'afficherait une fraction de seconde en sombre avant de basculer en clair.
// C'est aussi pourquoi ce fichier ne contient ni `import` ni `export`.
//
// Partage par `admin.html` et `editeur.html` : les deux doivent s'accorder sur
// la cle de stockage, sinon regler l'apparence d'un cote ne la regle pas de
// l'autre.
(function () {
  'use strict';

  var CLE = 'admin-apparence';

  // Trois etats et non deux. « Systeme » ne pose aucun attribut et laisse
  // `prefers-color-scheme` decider : la console suit le telephone qui passe en
  // sombre le soir. Les deux autres forcent, pour qui veut du clair sur un
  // systeme sombre — ou l'inverse, dans une piece sombre pendant un evenement.
  var ETATS = [
    { v: null,    t: 'Systeme' },
    { v: 'light', t: 'Clair'   },
    { v: 'dark',  t: 'Sombre'  },
  ];

  // ── Avant le rendu : poser l'attribut memorise ──
  try {
    var memo = localStorage.getItem(CLE);
    if (memo === 'light' || memo === 'dark') document.documentElement.dataset.theme = memo;
  } catch (e) { /* navigation privee, stockage bloque : on reste sur « systeme » */ }

  function courant() {
    return document.documentElement.dataset.theme || null;
  }

  function appliquer(i) {
    var e = ETATS[i], h = document.documentElement;
    if (e.v) h.dataset.theme = e.v; else delete h.dataset.theme;

    // Le navigateur peint ses ascenseurs, ses menus de <select> et le
    // calendrier des champs de date d'apres ceci, pas d'apres le CSS. Sans
    // cette ligne ils restent sombres au milieu d'une page claire.
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.content = e.v || 'dark light';

    var b = document.getElementById('theme-btn');
    if (b) b.textContent = e.t;

    try {
      if (e.v) localStorage.setItem(CLE, e.v); else localStorage.removeItem(CLE);
    } catch (err) { /* sans stockage, le choix ne survit pas au rechargement */ }
  }

  function basculer() {
    var i = ETATS.findIndex(function (e) { return e.v === courant(); });
    appliquer((i + 1) % ETATS.length);
  }

  // Le bouton n'existe pas encore quand ce script tourne : on met son libelle
  // au bon etat des que le document est pret.
  function libeller() {
    var i = ETATS.findIndex(function (e) { return e.v === courant(); });
    var b = document.getElementById('theme-btn');
    if (b) b.textContent = ETATS[Math.max(0, i)].t;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', libeller);
  } else {
    libeller();
  }

  window.basculerApparence = basculer;
})();

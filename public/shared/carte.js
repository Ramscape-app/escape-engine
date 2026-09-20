// Le fond de carte, en un seul endroit.
//
// Pourquoi ce fichier existe : les tuiles venaient de CARTO, en dur dans deux
// pages. CARTO s'est mis a exiger une cle d'API, et les deux cartes se sont
// couvertes d'un filigrane « API KEY REQUIRED » — sans erreur, sans trace, et
// visible seulement par un joueur en pleine partie.
//
// Trois lecons appliquees ici :
//   1. UNE source declaree en un point, changeable en une ligne ;
//   2. un echec de tuiles se VOIT et se dit, au lieu de laisser une carte
//      grise ou filigranee ;
//   3. l'attribution est affichee. Les tuiles derivees d'OpenStreetMap la
//      demandent, et les deux cartes la desactivaient.
//
// Script classique et non module, comme `apparence.js` : les pages qui s'en
// servent ont un script classique, et un module serait execute apres elles.
(function () {
  'use strict';

  // OpenStreetMap sert ses tuiles sans cle. Sa politique d'usage demande
  // l'attribution et vise les gros volumes — une poignee de joueurs par
  // evenement reste tres en dessous.
  //
  // Si celui-ci venait a manquer a son tour, il suffit de changer `DEFAUT`.
  // Les autres entrees sont la pour ca, pas pour etre melangees.
  var FOURNISSEURS = {
    osm: {
      nom: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap',
      zoomMax: 19,
    },
    // Ancien fond, garde pour memoire : exige desormais une cle d'API.
    // carto: {
    //   nom: 'CARTO Positron',
    //   url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    //   attribution: '© OpenStreetMap, © CARTO',
    //   zoomMax: 19,
    // },
  };

  var DEFAUT = 'osm';

  // Quand considerer que le fond ne repond pas.
  //
  // Un seuil d'echecs seul ne marche pas : au zoom monde la carte ne demande
  // que quatre tuiles, donc un seuil de six ne se declenchait jamais — le
  // message n'apparaissait pas, ce que le test a montre. Le bon critere est
  // « plusieurs echecs ET aucune tuile chargee » : une tuile isolee qui rate
  // ne declenche rien, un fond mort se signale des le troisieme echec.
  var SEUIL_ECHECS = 3;

  // Ajoute le fond a une carte Leaflet.
  //
  //   ajouter(L, carte, { sombre, surEchec })
  //
  // `sombre` retourne les couleurs par un filtre CSS : le moteur de jeu est
  // sombre, et un fond clair y ferait une tache. C'est le seul moyen d'obtenir
  // une carte sombre sans fournisseur a cle.
  // `surEchec` est appele une fois si les tuiles ne repondent pas, pour que la
  // page le dise a sa facon.
  function ajouter(L, carte, options) {
    options = options || {};
    var f = FOURNISSEURS[options.fournisseur || DEFAUT] || FOURNISSEURS[DEFAUT];

    var couche = L.tileLayer(f.url, {
      maxZoom: f.zoomMax,
      crossOrigin: true,
      attribution: f.attribution,
    });

    var echecs = 0, charges = 0, signale = false;
    couche.on('tileload', function () { charges++; });
    couche.on('tileerror', function () {
      echecs++;
      if (signale || charges > 0 || echecs < SEUIL_ECHECS) return;
      signale = true;
      if (typeof options.surEchec === 'function') options.surEchec(f);
      else console.error('Fond de carte indisponible : ' + f.nom + ' (' + f.url + ')');
    });

    couche.addTo(carte);

    var conteneur = carte.getContainer();
    if (options.sombre) conteneur.classList.add('carte-sombre');

    // Le style du filtre voyage avec le module, pour que la page appelante
    // n'ait rien a connaitre de son fonctionnement.
    if (options.sombre && !document.getElementById('style-carte-sombre')) {
      var st = document.createElement('style');
      st.id = 'style-carte-sombre';
      st.textContent = '.carte-sombre .leaflet-tile-pane{' +
        'filter:invert(1) hue-rotate(180deg) brightness(.82) contrast(1.08) saturate(.55)}' +
        '.carte-sombre .leaflet-control-attribution{' +
        'background:rgba(0,0,0,.45);color:#8a8aa0}' +
        '.carte-sombre .leaflet-control-attribution a{color:#8a8aa0}';
      document.head.appendChild(st);
    }

    return couche;
  }

  window.FondCarte = { ajouter: ajouter, FOURNISSEURS: FOURNISSEURS, DEFAUT: DEFAUT };
})();

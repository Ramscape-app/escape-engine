// Les textes des trois pages d'introduction, en l'absence de personnalisation.
//
// Ils vivaient dans `public/index.html` et nulle part ailleurs : le moteur les
// appliquait, et l'editeur affichait des champs vides. L'organisateur editait
// donc a l'aveugle un texte qu'il ne voyait pas, et ne pouvait pas « partir de
// la base » sans tout retaper.
//
// Une seule source desormais, lue par le moteur ET par l'editeur.
// ⚠️ Le moteur FUSIONNE ces valeurs avec celles du jeu, cle par cle et par
//    page : un jeu qui ne definit que `boot.logo` garde ici tout le reste.
//    Modifier une valeur change donc le rendu de tous les jeux qui ne l'ont
//    pas surchargee.
export const INTRO_DEFAUT = {
  preboot: {
    icon: "🛡️",
    banner: "/// PROTOCOLE DE SÉCURITÉ ///",
    subtitle: "BRIEFING PRÉ-MISSION",
    consignes: [
      { icon: "📍", titre: "GÉOLOCALISATION", texte: "Certaines épreuves nécessitent votre position GPS. Autorisez l'accès quand demandé." },
      { icon: "📡", titre: "MODULE NFC", texte: "Un scan NFC sera requis. Assurez-vous que le NFC est activé dans vos paramètres." },
      { icon: "📷", titre: "CAMÉRA & FLASH", texte: "L'accès à la caméra sera sollicité pour des modules de détection optique." },
      { icon: "🔊", titre: "AUDIO", texte: "Activez le son. Des transmissions audio cryptées devront être analysées." },
    ],
    warning: "⚠ AVERTISSEMENT : Toute tentative de fermeture durant une épreuve entraînera la perte définitive de votre progression. L'agence décline toute responsabilité en cas de surchauffe neuronale.",
    button: "J'AI COMPRIS — INITIALISER",
    footer: "CLASSIFICATION : NIVEAU OMEGA",
  },
  boot: {
    logo: "PROJET 1986",
    subtitle: "Système de réactivation",
    lines: [
      "Initialisation du système...", "Chargement module PROJET_1986", "Vérification profil agent",
      "Connexion base de données", "Scan biométrique", "Calibration énigmes",
      "Chargement module GUADELOUPE", "Activation protocole ANNIVERSAIRE", "Système prêt",
    ],
    music: "",
  },
  intro: {
    classified: "/// CONFIDENTIEL ///",
    // `{total}` est remplace par le nombre d'enigmes du jeu.
    brief: "Agent, votre profil a été <strong>sélectionné</strong>.<br><br>En <strong>1986</strong>, un sujet exceptionnel a vu le jour. Aujourd'hui, <strong>40 ans plus tard</strong>, il est temps de prouver que les années n'ont fait que renforcer ses capacités.<br><br><strong>{total} épreuves</strong> vous attendent. Logique, mémoire, agilité, culture… chaque réponse correcte vous rapproche de la <strong>récompense finale</strong>.<br><br>Aucun retour en arrière possible.<br><span style=\"color:var(--warn)\">Bonne chance.</span>",
    button: "ACCEPTER LA MISSION",
  },
};

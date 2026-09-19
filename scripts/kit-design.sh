#!/usr/bin/env bash
# Régénère le kit de design de la console d'administration.
#
# À rejouer après toute modification d'`admin.html` : sans ça, le kit livré au
# designer décrit un écran qui n'existe plus, et son retour ne s'intègre pas.
#
#   bash scripts/kit-design.sh
set -euo pipefail
cd "$(dirname "$0")/.."

KIT=design/admin-design-kit
mkdir -p "$KIT/css" "$KIT/src" "$KIT/captures"

# 1. La feuille de style, extraite telle quelle, et la copie de l'application
#    privée de ses identifiants de connexion. Ils sont publics — ils partent
#    dans la page servie à chaque visiteur — mais rien ne justifie de les
#    promener dans un dossier qui circule.
node -e '
const fs = require("fs");
const src = fs.readFileSync("public/admin.html", "utf8");
const a = src.indexOf("<style>") + 7, b = src.indexOf("</style>");
fs.writeFileSync("design/admin-design-kit/css/admin.css", src.slice(a, b).replace(/^\n/, ""));
// Les vraies valeurs sont relevees dans la source, puis leur absence est
// verifiee dans le resultat. Chercher un *motif* ne marche pas : le
// remplacement en porte un lui aussi, et le garde-fou se declenchait sur son
// propre placeholder.
const vraies = [
  (src.match(/const SUPABASE_ANON\s*=\s*"([^"]*)"/) || [])[1],
  (src.match(/const SUPABASE_URL\s*=\s*"https:\/\/([^.]*)\./) || [])[1],
].filter(v => v && v.length > 6);

const expurge = src
  .replace(/const SUPABASE_URL\s*=\s*"[^"]*"/, "const SUPABASE_URL  = \"https://VOTRE-PROJET.supabase.co\"")
  .replace(/const SUPABASE_ANON\s*=\s*"[^"]*"/, "const SUPABASE_ANON = \"sb_publishable_XXXXXXXXXXXX\"")
  .replace(new RegExp(vraies.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g"), "VOTRE-PROJET");

const restants = vraies.filter(v => expurge.includes(v));
if (!vraies.length || restants.length) {
  console.error("✗ identifiant residuel ou introuvable — kit non genere");
  process.exit(1);
}
fs.writeFileSync("design/admin-design-kit/src/admin.html", expurge);
console.log("✓ css/admin.css + src/admin.html");
'

# 2. Le contrat (classes, ids, jetons) relevé dans la page, pas à la main.
node scripts/inventaire-admin.mjs --contrat

# 3. L'atelier doit montrer chaque classe stylée, sinon le designer travaille
#    sur une partie seulement de la console sans le savoir.
node scripts/inventaire-admin.mjs --manquants

# 4. Le zip, hors dépôt (voir .gitignore).
rm -f design/admin-design-kit.zip
if command -v zip >/dev/null 2>&1; then
  (cd design && zip -rq admin-design-kit.zip admin-design-kit/)
else
  python3 -c "import shutil; shutil.make_archive('design/admin-design-kit','zip','design','admin-design-kit')"
fi
echo "✓ design/admin-design-kit.zip ($(du -h design/admin-design-kit.zip | cut -f1))"
echo
echo "Les captures se refont à part : elles demandent Chromium."
echo "Voir design/CAPTURES.md."

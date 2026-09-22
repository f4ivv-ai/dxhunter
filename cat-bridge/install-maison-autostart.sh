#!/bin/bash
# Installe le bridge Maison / FLEX-6600M comme LaunchAgent macOS.
# Le bridge démarre au login et reste volontairement en lecture seule par défaut.

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="${DXHUNTER_BRIDGE_DIR:-$HOME/dxhunter-bridge}"
CONFIG_DIR="${DXHUNTER_CONFIG_DIR:-$HOME/.config/dxhunter}"
CONFIG_FILE="$CONFIG_DIR/maison-flex-6600m.env"
PLIST_NAME="com.dxhunter.maison-flex-6600m.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
UID_VALUE="$(id -u)"
NODE_PATH="$(command -v node || true)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ERREUR] Ce script est prévu pour macOS et launchd." >&2
  exit 64
fi
if [[ -z "$NODE_PATH" ]]; then
  echo "[ERREUR] Node.js 18 ou plus est requis." >&2
  exit 69
fi

mkdir -p "$BRIDGE_DIR" "$CONFIG_DIR" "$HOME/Library/LaunchAgents"
install -m 700 "$SOURCE_DIR/bridge-relay-v8.mjs" "$BRIDGE_DIR/bridge-relay-v8.mjs"
install -m 700 "$SOURCE_DIR/start-maison-flex-6600m.sh" "$BRIDGE_DIR/start-maison-flex-6600m.sh"

if [[ ! -f "$CONFIG_FILE" ]]; then
  install -m 600 "$SOURCE_DIR/maison-flex-6600m.env.example" "$CONFIG_FILE"
  echo "[À CONFIGURER] $CONFIG_FILE a été créé. Remplacez FLEX_IP=CHANGE_ME puis relancez ce script."
  exit 78
fi

FLEX_IP_VALUE="$(sed -n 's/^FLEX_IP="\([^"]*\)"/\1/p' "$CONFIG_FILE" | head -n 1)"
if [[ -z "$FLEX_IP_VALUE" || "$FLEX_IP_VALUE" == "CHANGE_ME" ]]; then
  echo "[ERREUR] Renseignez l’adresse locale du FLEX-6600M dans $CONFIG_FILE puis relancez ce script." >&2
  exit 78
fi

TOKEN_SERVICE="${DXHUNTER_TOKEN_SERVICE:-dxhunter-maison-cat}"
TOKEN="$(security find-generic-password -a "$USER" -s "$TOKEN_SERVICE" -w 2>/dev/null || true)"
if [[ ${#TOKEN} -lt 24 ]]; then
  echo "[ERREUR] Aucun jeton CAT valide n’est enregistré dans le Trousseau macOS." >&2
  echo "Ajoutez-le sans l’écrire dans un fichier :" >&2
  echo "  read -s 'TOKEN?Jeton CAT : '; echo; security add-generic-password -U -a \"$USER\" -s \"$TOKEN_SERVICE\" -w \"$TOKEN\"" >&2
  exit 78
fi
unset TOKEN

sed \
  -e "s|__BRIDGE_DIR__|$BRIDGE_DIR|g" \
  "$SOURCE_DIR/com.dxhunter.maison-flex-6600m.plist.template" > "$PLIST_DST"
plutil -lint "$PLIST_DST" >/dev/null

launchctl bootout "gui/$UID_VALUE" "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST_DST"
launchctl kickstart -k "gui/$UID_VALUE/com.dxhunter.maison-flex-6600m"

echo "[OK] Bridge Maison / FLEX-6600M installé et démarré."
echo "[OK] Mode initial : monitor (lecture seule, toutes commandes radio bloquées)."
echo "[INFO] Configuration : $CONFIG_FILE"
echo "[INFO] Logs          : $BRIDGE_DIR/maison-flex-6600m.log"
echo "[INFO] État          : launchctl print gui/$UID_VALUE/com.dxhunter.maison-flex-6600m"

#!/bin/bash
# Installe le bridge ARCO Maison comme LaunchAgent macOS.
# Le mouvement reste bloqué tant que maison-arco.env est en mode monitor.

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="${DXHUNTER_BRIDGE_DIR:-$HOME/dxhunter-bridge}"
CONFIG_DIR="${DXHUNTER_CONFIG_DIR:-$HOME/.config/dxhunter}"
CONFIG_FILE="$CONFIG_DIR/maison-arco.env"
PLIST_NAME="com.dxhunter.maison-arco.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
UID_VALUE="$(id -u)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ERREUR] Ce script est prévu pour macOS et launchd." >&2
  exit 64
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[ERREUR] Node.js 18 ou plus est requis." >&2
  exit 69
fi

mkdir -p "$BRIDGE_DIR" "$CONFIG_DIR" "$HOME/Library/LaunchAgents"
install -m 700 "$SOURCE_DIR/arco-maison-bridge.mjs" "$BRIDGE_DIR/arco-maison-bridge.mjs"
install -m 700 "$SOURCE_DIR/start-maison-arco.sh" "$BRIDGE_DIR/start-maison-arco.sh"

if [[ ! -f "$CONFIG_FILE" ]]; then
  install -m 600 "$SOURCE_DIR/maison-arco.env.example" "$CONFIG_FILE"
  echo "[À CONFIGURER] $CONFIG_FILE a été créé. Renseignez ARCO_ADAPTER_URL locale puis relancez ce script."
  exit 78
fi

ADAPTER_VALUE="$(sed -n 's/^ARCO_ADAPTER_URL="\([^"]*\)"/\1/p' "$CONFIG_FILE" | head -n 1)"
if [[ -z "$ADAPTER_VALUE" || "$ADAPTER_VALUE" == "CHANGE_ME" ]]; then
  echo "[ERREUR] Renseignez l'adaptateur ARCO local dans $CONFIG_FILE puis relancez ce script." >&2
  exit 78
fi

TOKEN_SERVICE="${DXHUNTER_ARCO_TOKEN_SERVICE:-dxhunter-maison-arco}"
TOKEN="$(security find-generic-password -a "$USER" -s "$TOKEN_SERVICE" -w 2>/dev/null || true)"
if [[ ${#TOKEN} -lt 24 ]]; then
  echo "[ERREUR] Aucun jeton ARCO valide n'est enregistré dans le Trousseau macOS." >&2
  echo "Ajoutez-le sans l’écrire dans un fichier :" >&2
  echo "  read -s 'TOKEN?Jeton ARCO : '; echo; security add-generic-password -U -a \"$USER\" -s \"$TOKEN_SERVICE\" -w \"$TOKEN\"" >&2
  exit 78
fi
unset TOKEN

sed -e "s|__BRIDGE_DIR__|$BRIDGE_DIR|g" "$SOURCE_DIR/com.dxhunter.maison-arco.plist.template" > "$PLIST_DST"
plutil -lint "$PLIST_DST" >/dev/null

launchctl bootout "gui/$UID_VALUE" "$PLIST_DST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST_DST"
launchctl kickstart -k "gui/$UID_VALUE/com.dxhunter.maison-arco"

echo "[OK] Bridge ARCO Maison installé et démarré."
echo "[OK] Mode initial : monitor (position et état seulement ; mouvements bloqués)."
echo "[INFO] Configuration : $CONFIG_FILE"
echo "[INFO] Logs          : $BRIDGE_DIR/maison-arco.log"

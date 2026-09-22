#!/bin/bash
# DX Hunter — démarrage sécurisé du bridge ARCO Maison.
# Le bridge est en lecture seule par défaut et ne permet aucun mouvement.

set -euo pipefail

BRIDGE_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${DXHUNTER_CONFIG_DIR:-$HOME/.config/dxhunter}"
CONFIG_FILE="${MAISON_ARCO_CONFIG:-$CONFIG_DIR/maison-arco.env}"
TOKEN_SERVICE="${DXHUNTER_ARCO_TOKEN_SERVICE:-dxhunter-maison-arco}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[ERREUR] Configuration ARCO introuvable : $CONFIG_FILE" >&2
  echo "Copiez maison-arco.env.example vers ce fichier, renseignez ARCO_ADAPTER_URL puis réessayez." >&2
  exit 78
fi

set -a
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

: "${ARCO_ADAPTER_URL:?ARCO_ADAPTER_URL doit être renseigné dans $CONFIG_FILE}"
export STATION_NAME="${STATION_NAME:-Maison}"
export CONTROLLER_NAME="${CONTROLLER_NAME:-microHAM ARCO}"
export SERVER_URL="${SERVER_URL:-https://dxclusterf4ivv.manus.space}"
export OPERATION_MODE="${OPERATION_MODE:-monitor}"
export ALLOW_ARCO_MOTION="${ALLOW_ARCO_MOTION:-false}"

if [[ "$OPERATION_MODE" != "monitor" && "$OPERATION_MODE" != "operate" ]]; then
  echo "[ERREUR] OPERATION_MODE doit être monitor ou operate." >&2
  exit 78
fi

TOKEN="$(security find-generic-password -a "$USER" -s "$TOKEN_SERVICE" -w 2>/dev/null || true)"
if [[ ${#TOKEN} -lt 24 ]]; then
  echo "[ERREUR] Jeton ARCO absent ou invalide dans le Trousseau macOS : $TOKEN_SERVICE" >&2
  exit 78
fi
export TOKEN

if [[ "$OPERATION_MODE" == "monitor" ]]; then
  echo "[Maison] Bridge ARCO démarré en LECTURE SEULE. Les mouvements sont bloqués."
else
  echo "[Maison] Bridge ARCO démarré en mode PILOTAGE. Les mouvements exigent ALLOW_ARCO_MOTION=true."
fi

exec node "$BRIDGE_DIR/arco-maison-bridge.mjs"

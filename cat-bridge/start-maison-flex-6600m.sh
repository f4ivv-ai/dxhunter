#!/bin/bash
# DX Hunter — Maison / FLEX-6600M
# Démarrage sûr du bridge local. Le mode par défaut est MONITOR : télémétrie seule.

set -euo pipefail

BRIDGE_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="${DXHUNTER_CONFIG_DIR:-$HOME/.config/dxhunter}"
CONFIG_FILE="${MAISON_FLEX_CONFIG:-$CONFIG_DIR/maison-flex-6600m.env}"
TOKEN_SERVICE="${DXHUNTER_TOKEN_SERVICE:-dxhunter-maison-cat}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[ERREUR] Configuration introuvable : $CONFIG_FILE" >&2
  echo "Copiez maison-flex-6600m.env.example vers ce fichier, renseignez FLEX_IP puis réessayez." >&2
  exit 78
fi

# Le fichier de configuration ne contient aucune clé : seulement des paramètres de station.
set -a
# shellcheck source=/dev/null
source "$CONFIG_FILE"
set +a

: "${FLEX_IP:?FLEX_IP doit être renseigné dans $CONFIG_FILE}"
export STATION_NAME="${STATION_NAME:-Maison}"
export RADIO_MODEL="${RADIO_MODEL:-FLEX-6600M}"
export FLEX_PORT="${FLEX_PORT:-4992}"
export SLICE_ID="${SLICE_ID:-0}"
export SERVER_URL="${SERVER_URL:-https://dxclusterf4ivv.manus.space}"
export OPERATION_MODE="${OPERATION_MODE:-monitor}"
export ALLOW_TX_CONTROL="${ALLOW_TX_CONTROL:-false}"
export AG_ENABLED="${AG_ENABLED:-false}"
export AG_HOST="${AG_HOST:-127.0.0.1}"
export AG_PORT="${AG_PORT:-9007}"

if [[ "$OPERATION_MODE" != "monitor" && "$OPERATION_MODE" != "operate" ]]; then
  echo "[ERREUR] OPERATION_MODE doit être monitor ou operate." >&2
  exit 78
fi

if ! command -v security >/dev/null 2>&1; then
  echo "[ERREUR] Le Trousseau macOS (security) est requis pour lire le jeton du bridge." >&2
  exit 78
fi

TOKEN="$(security find-generic-password -a "$USER" -s "$TOKEN_SERVICE" -w 2>/dev/null || true)"
if [[ ${#TOKEN} -lt 24 ]]; then
  echo "[ERREUR] Jeton absent ou invalide dans le Trousseau macOS : $TOKEN_SERVICE" >&2
  echo "Ajoutez-le avec : read -s 'TOKEN?Jeton CAT : '; echo; security add-generic-password -U -a \"$USER\" -s \"$TOKEN_SERVICE\" -w \"$TOKEN\"" >&2
  exit 78
fi
export TOKEN

if [[ "$OPERATION_MODE" == "monitor" ]]; then
  echo "[Maison] Bridge FLEX-6600M démarré en LECTURE SEULE. Aucune commande radio ne sera exécutée."
else
  echo "[Maison] Bridge FLEX-6600M démarré en mode PILOTAGE. MOX/TUNE restent bloqués sans ALLOW_TX_CONTROL=true."
fi

exec node "$BRIDGE_DIR/bridge-relay-v8.mjs"

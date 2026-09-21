#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DX HUNTER — Lancement Bridge SO2R (Dual FlexRadio via SmartSDR Kenwood CAT)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Prérequis :
#   - Node.js 18+ installé sur le Mac
#   - SmartSDR for Mac connecté aux deux Flex (SmartLink ou local)
#   - Port CAT activé dans SmartSDR pour chaque radio :
#     Radio A (Flex 6401) → port 5001
#     Radio B (Flex 8600) → port 5002
#
# Usage :
#   chmod +x start-bridge-so2r.sh
#   ./start-bridge-so2r.sh
#
# Pour modifier les paramètres, éditez les variables ci-dessous :
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Configuration ────────────────────────────────────────────────────────────

# IP de la machine où tourne SmartSDR (127.0.0.1 si local)
export CAT_HOST="127.0.0.1"

# Ports CAT Kenwood (configurés dans SmartSDR → Preferences → CAT)
export PORT_A="5001"    # Flex 6401
export PORT_B="5002"    # Flex 8600

# Noms des radios (affichage dans l'interface)
export NAME_A="Flex 6401"
export NAME_B="Flex 8600"

# Radio initiale en RUN (A ou B)
export INITIAL_RUN="A"

# URL du serveur DX Hunter
export SERVER_URL="https://dxclusterf4ivv.manus.space"

# Token d'authentification bridge
: "${TOKEN:?Définissez TOKEN (24 caractères minimum, identique à CAT_BRIDGE_TOKEN)}"
export TOKEN

# Intervalles (ms)
export PUSH_INTERVAL="800"
export POLL_INTERVAL="1500"

# Mode verbose (true/false) — affiche toutes les commandes CAT
export VERBOSE="false"

# ─── Lancement ────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_FILE="$SCRIPT_DIR/bridge-so2r.mjs"

if [ ! -f "$BRIDGE_FILE" ]; then
  echo "❌ Fichier bridge-so2r.mjs introuvable dans $SCRIPT_DIR"
  echo "   Téléchargez-le depuis DX Hunter et placez-le dans le même dossier."
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DX HUNTER — Bridge SO2R                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Radio A : $NAME_A → $CAT_HOST:$PORT_A"
echo "║  Radio B : $NAME_B → $CAT_HOST:$PORT_B"
echo "║  RUN     : Radio $INITIAL_RUN"
echo "║  Serveur : $SERVER_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Ctrl+C pour arrêter"
echo ""

node "$BRIDGE_FILE"

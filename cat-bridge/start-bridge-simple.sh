#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DX HUNTER — Bridge Simple v1.0 (1 VFO)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Mode simple : 1 seul panadapteur suffit.
# Polling safe (IF; PC; NB;) — pas de FA/FB/SM0.
# Compatible SmartLink.
#
# Usage :
#   chmod +x start-bridge-simple.sh
#   ./start-bridge-simple.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Configuration ────────────────────────────────────────────────────────────
export SERVER_URL="https://dxclusterf4ivv.manus.space"
: "${TOKEN:?Définissez TOKEN (24 caractères minimum, identique à CAT_BRIDGE_TOKEN)}"
export TOKEN
export CAT_HOST="127.0.0.1"
export CAT_PORT="5001"
export VERBOSE="false"

# ─── Affichage ────────────────────────────────────────────────────────────────
clear
echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║  DX HUNTER — Bridge Simple v1.0                         ║"
echo "  ╠══════════════════════════════════════════════════════════╣"
echo "  ║  Mode    : 1 VFO (1 seul panadapteur)                  ║"
echo "  ║  CAT     : $CAT_HOST:$CAT_PORT                         ║"
echo "  ║  Serveur : $SERVER_URL                                  ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Ctrl+C pour arrêter"
echo ""

# ─── Vérification Node.js ─────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trouvé. Installe-le : https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ requis (trouvé: $(node -v))"
  exit 1
fi

# ─── Lancement ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/bridge-simple.mjs"

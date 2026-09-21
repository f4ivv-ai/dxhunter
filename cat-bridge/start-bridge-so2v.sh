#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# DX HUNTER — Lanceur Bridge SO2V v2.1 (CAT Only)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Commandes supportées par SmartSDR en WAN :
#   ✅ Filtres audio (SL/SH)
#   ✅ DSP (NB/NR/ANF)
#   ✅ EQ on/off
#   ✅ Puissance (PC)
#   ✅ TX/RX (émission)
#   ✅ QSY (FA/FB)
#   ✅ Mode (MD)
#
# SmartSDR DOIT être en cours d'exécution.
# Fonctionne avec 1 ou 2 panadapteurs (auto-détection).
#
# ═══════════════════════════════════════════════════════════════════════════════

# ─── CAT (SmartSDR CAT) ──────────────────────────────────────────────────────
export CAT_HOST="127.0.0.1"
export CAT_PORT="5001"

# ─── Rôles SO2V ──────────────────────────────────────────────────────────────
export INITIAL_RUN="A"

# ─── Serveur DX Hunter ───────────────────────────────────────────────────────
export SERVER_URL="https://dxclusterf4ivv.manus.space"
: "${TOKEN:?Définissez TOKEN (24 caractères minimum, identique à CAT_BRIDGE_TOKEN)}"
export TOKEN

# ─── Timing ──────────────────────────────────────────────────────────────────
export PUSH_INTERVAL="800"
export POLL_INTERVAL="1200"

# ─── Debug ────────────────────────────────────────────────────────────────────
export VERBOSE="false"

# ─── Lancement ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_FILE="$SCRIPT_DIR/bridge-so2v.mjs"

if [ ! -f "$BRIDGE_FILE" ]; then
  echo "❌ Fichier bridge-so2v.mjs introuvable dans $SCRIPT_DIR"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  DX HUNTER — Bridge SO2V v2.1 (Single + Dual Slice)        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  CAT     : $CAT_HOST:$CAT_PORT"
echo "║  RUN     : Slice $INITIAL_RUN"
echo "║  Serveur : $SERVER_URL"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Ctrl+C pour arrêter"
echo ""

node "$BRIDGE_FILE"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# DX HUNTER — Bridge Relay v8.0 (FlexRadio Native API — port 4992)
# ═══════════════════════════════════════════════════════════════════════
#
# Connexion directe au FlexRadio via l'API native (pas via SmartSDR CAT).
# Donne accès à TOUT : spots panadapter, EQ, APF, antennes, télémétrie.
#
# CONFIGURATION :
#   Modifie les variables ci-dessous selon ton installation.
#   Ou passe-les en variables d'environnement.
#
# USAGE :
#   ./start-bridge-v8.sh
#   ou : FLEX_IP=192.168.1.42 ./start-bridge-v8.sh
# ═══════════════════════════════════════════════════════════════════════

# ─── IP du FlexRadio sur ton réseau local ───
export FLEX_IP="${FLEX_IP:-192.168.1.100}"
export FLEX_PORT="${FLEX_PORT:-4992}"

# ─── Slice à contrôler (0 = slice A, 1 = slice B) ───
export SLICE_ID="${SLICE_ID:-0}"

# ─── Serveur DX Hunter ───
export SERVER_URL="${SERVER_URL:-https://dxclusterf4ivv.manus.space}"
: "${TOKEN:?Définissez TOKEN (24 caractères minimum, identique à CAT_BRIDGE_TOKEN)}"
export TOKEN

# ─── Antenna Genius (désactivé par défaut) ───
export AG_ENABLED="${AG_ENABLED:-false}"
export AG_HOST="${AG_HOST:-192.168.1.200}"
export AG_PORT="${AG_PORT:-9007}"

# ─── Lancement ───
DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "  DX HUNTER Bridge v8.0 — FlexRadio Native API"
echo "  FlexRadio : $FLEX_IP:$FLEX_PORT (Slice $SLICE_ID)"
echo "  Serveur   : $SERVER_URL"
echo ""

exec node "$DIR/bridge-relay-v8.mjs"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# DX HUNTER — Démarrage Bridge v7.1 (Kenwood CAT + SmartLink)
# ═══════════════════════════════════════════════════════════════
#
# Ce bridge se connecte au port CAT Kenwood de SmartSDR (5001)
# Compatible SmartLink (accès distant via SmartSDR Mac/Win)
#
# CONFIGURATION : adapter les variables ci-dessous
# ═══════════════════════════════════════════════════════════════

# URL du serveur DX Hunter
export SERVER_URL="${SERVER_URL:-https://dxclusterf4ivv.manus.space}"

# Token d'authentification (doit correspondre au serveur)
: "${TOKEN:?Définissez TOKEN (24 caractères minimum, identique à CAT_BRIDGE_TOKEN)}"
export TOKEN

# SmartSDR CAT port (localhost car SmartSDR tourne sur ce Mac)
export CAT_HOST="${CAT_HOST:-127.0.0.1}"
export CAT_PORT="${CAT_PORT:-5001}"

# Antenna Genius (mettre l'IP de ton AG sur le réseau local)
# Si pas d'AG ou pas accessible en SmartLink, mettre AG_ENABLED=false
export AG_HOST="${AG_HOST:-127.0.0.1}"
export AG_PORT="${AG_PORT:-9007}"
export AG_ENABLED="${AG_ENABLED:-false}"

# ═══════════════════════════════════════════════════════════════
# LANCEMENT
# ═══════════════════════════════════════════════════════════════
echo ""
echo "  DX HUNTER — Bridge v7.1 (Kenwood CAT)"
echo "  SmartLink compatible"
echo ""
echo "  CAT: $CAT_HOST:$CAT_PORT"
echo "  AG:  $AG_HOST:$AG_PORT (enabled: $AG_ENABLED)"
echo "  Serveur: $SERVER_URL"
echo ""

node "$(dirname "$0")/bridge-relay-v7.mjs"

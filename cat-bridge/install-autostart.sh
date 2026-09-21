#!/bin/bash
# DX Hunter — Installation auto-démarrage du bridge CAT
# Ce script installe le service launchd pour que le bridge se lance au login.

set -e

PLIST_NAME="com.dxhunter.cat-bridge.plist"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
BRIDGE_DIR="$HOME/dxhunter-bridge"
NODE_PATH=$(which node)

echo "========================================"
echo "  DX HUNTER — Installation auto-start"
echo "========================================"
echo ""

# Vérifier que le bridge existe
if [ ! -f "$BRIDGE_DIR/bridge-relay.mjs" ]; then
    echo "[ERREUR] bridge-relay.mjs introuvable dans $BRIDGE_DIR"
    echo "         Placez-y le fichier d'abord."
    exit 1
fi

# Vérifier Node.js
if [ -z "$NODE_PATH" ]; then
    echo "[ERREUR] Node.js introuvable. Installez-le d'abord."
    exit 1
fi
echo "[OK] Node.js: $NODE_PATH"

# Adapter le plist avec le bon chemin Node.js et le bon user
sed "s|/usr/local/bin/node|$NODE_PATH|g" "$PLIST_SRC" | \
sed "s|/Users/didiercrochat|$HOME|g" > "$PLIST_DST"

echo "[OK] Plist installé: $PLIST_DST"

# Décharger si déjà chargé
launchctl unload "$PLIST_DST" 2>/dev/null || true

# Charger le service
launchctl load "$PLIST_DST"
echo "[OK] Service chargé et démarré"
echo ""
echo "Le bridge CAT démarrera automatiquement à chaque login."
echo ""
echo "Commandes utiles :"
echo "  Voir les logs :    tail -f ~/dxhunter-bridge/bridge.log"
echo "  Arrêter :          launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Redémarrer :       launchctl unload ~/Library/LaunchAgents/$PLIST_NAME && launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
echo "  Désinstaller :     launchctl unload ~/Library/LaunchAgents/$PLIST_NAME && rm ~/Library/LaunchAgents/$PLIST_NAME"
echo ""

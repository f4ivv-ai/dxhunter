#!/bin/bash
echo "═══════════════════════════════════════"
echo "  DX Daruma CAT Bridge - Démarrage"
echo "═══════════════════════════════════════"
echo ""

# --- MODIFIEZ ICI SELON VOTRE POSTE ---

# Pour FlexRadio (auto-découverte) :
node bridge.mjs --mode flex --discover

# Pour FlexRadio (IP directe) :
# node bridge.mjs --mode flex --radio 192.168.1.100

# Pour Yaesu :
# node bridge.mjs --mode yaesu --serial /dev/cu.usbserial-14310 --baud 38400

# Pour Icom :
# node bridge.mjs --mode icom --serial /dev/cu.usbserial-14310 --baud 19200 --civ-addr 94

# Pour Kenwood :
# node bridge.mjs --mode kenwood --serial /dev/ttyUSB0 --baud 115200

# Pour Elecraft :
# node bridge.mjs --mode elecraft --serial /dev/ttyACM0 --baud 38400

# Pour Hamlib :
# node bridge.mjs --mode hamlib --host 127.0.0.1 --port 4532

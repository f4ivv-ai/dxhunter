#!/bin/bash
# DX Hunter — inventaire audio Maison, sans modifier les réglages macOS.
# À exécuter sur le MacBook Pro pour recopier les noms exacts dans
# ~/.config/dxhunter/maison-flex-6600m.env et SmartSDR for Mac.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[ERREUR] Ce script est prévu pour macOS." >&2
  exit 64
fi

echo "════════════════════════════════════════════════════════════"
echo " DX Hunter — périphériques audio détectés sur le MacBook Pro"
echo "════════════════════════════════════════════════════════════"
echo
echo "Ce script est en lecture seule : il ne change ni CoreAudio ni SmartSDR."
echo "Copiez les noms réels dans AUDIO_INPUT_DEVICE et AUDIO_OUTPUT_DEVICE."
echo
system_profiler SPAudioDataType

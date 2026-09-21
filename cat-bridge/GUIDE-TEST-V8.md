# DX HUNTER — Bridge v8.0 (FlexRadio Native API)

## Présentation

Le bridge v8.0 se connecte **directement** au FlexRadio via l'API native TCP (port 4992).
Contrairement au bridge v7.1 (Kenwood CAT via SmartSDR port 5001), il donne accès à **toutes** les fonctions du radio sans limitation.

### Comparaison v7.1 vs v8.0

| Fonction | v7.1 (Kenwood CAT) | v8.0 (Native API) |
|----------|--------------------|--------------------|
| QSY / Mode | ✓ | ✓ |
| Split (XIT) | ✗ | ✓ |
| Power | ✓ | ✓ |
| TUNE | ✓ (AC cmd, limité) | ✓ (transmit tune) |
| MOX | ✓ | ✓ (xmit) |
| NB / NR / ANF | ✓ | ✓ |
| APF | ✗ | ✓ |
| Filtre passe-bande | ✓ (SH/SL, imprécis) | ✓ (filt, exact) |
| RF Gain | ✓ (AG, mapping) | ✓ (rf_gain, direct dB) |
| EQ RX 8 bandes | ✗ | ✓ |
| Sélection antenne RX/TX | ✗ | ✓ |
| Spots panadapter | ✗ | ✓ |
| Télémétrie S-mètre | ✓ (SM, limité) | ✓ (meter sub, dBm) |
| Télémétrie Power/SWR/ALC | ✓ (RM, limité) | ✓ (meter sub) |
| PA Temp | ✗ | ✓ |
| Keepalive | Timeout 15s | Ping 4s (stable) |
| Connexion SmartLink | ✓ | ✗ (local uniquement) |

---

## Pré-requis

1. **FlexRadio allumé** et connecté au réseau WiFi/Ethernet
2. **Node.js 18+** installé sur le Mac
3. **L'IP du FlexRadio** — visible dans SmartSDR → Radio Setup, ou sur l'écran du Flex
4. **SmartSDR** peut tourner en parallèle (pas obligatoire sauf pour les spots panadapter)

> **Note** : Le bridge v8 se connecte directement au port 4992 du FlexRadio. SmartSDR peut tourner en même temps (multi-client supporté par le Flex 6000 series).

---

## Installation

```bash
cd ~/dxhunter-bridge

# Télécharger le bridge v8
curl -L -o bridge-relay-v8.mjs "https://dxclusterf4ivv.manus.space/manus-storage/bridge-relay-v8_XXXX.mjs"
curl -L -o start-bridge-v8.sh "https://dxclusterf4ivv.manus.space/manus-storage/start-bridge-v8_XXXX.sh"
chmod +x start-bridge-v8.sh
```

*(Les URLs exactes seront fournies après publication)*

---

## Configuration

Édite `start-bridge-v8.sh` ou passe les variables d'environnement :

```bash
# IP du FlexRadio (OBLIGATOIRE — à adapter à ton réseau)
export FLEX_IP="192.168.1.100"

# Port API native (ne pas changer sauf cas spécial)
export FLEX_PORT="4992"

# Slice à contrôler (0 = Slice A, 1 = Slice B)
export SLICE_ID="0"

# Antenna Genius (si tu en as un)
export AG_ENABLED="true"
export AG_HOST="192.168.1.200"
export AG_PORT="9007"
```

### Trouver l'IP du FlexRadio

- **SmartSDR** : Menu Radio → Settings → Network → IP Address
- **Écran du Flex** : Menu → Network → IP
- **Terminal** : `dns-sd -B _flex-6000._tcp` (macOS, découverte Bonjour)

---

## Lancement

### Méthode simple (script)

```bash
cd ~/dxhunter-bridge
FLEX_IP=192.168.1.42 ./start-bridge-v8.sh
```

### Méthode directe

```bash
cd ~/dxhunter-bridge
FLEX_IP=192.168.1.42 node bridge-relay-v8.mjs
```

### Sortie attendue

```
╔══════════════════════════════════════════════════════════════╗
║  DX HUNTER — Bridge Relay v8.0 (FlexRadio Native API)      ║
╠══════════════════════════════════════════════════════════════╣
║  FlexRadio  : 192.168.1.42:4992 (API native)              ║
║  Slice      : 0                                            ║
║  Ant Genius : DÉSACTIVÉ                                    ║
║  Serveur    : https://dxclusterf4ivv.manus.space           ║
╠══════════════════════════════════════════════════════════════╣
║  Fonctions (API native FlexRadio) :                        ║
║    ✓ Fréquence, mode, QSY, Split (XIT)                     ║
║    ✓ Power (transmit set rfpower)                           ║
║    ✓ TUNE (transmit tune on/off)                            ║
║    ✓ MOX (xmit 1/0)                                        ║
║    ✓ DSP : NB, NR, ANF, APF (slice set)                    ║
║    ✓ Filtre passe-bande (filt)                              ║
║    ✓ RF Gain (slice set rf_gain)                            ║
║    ✓ EQ RX 8 bandes (eq rxsc)                              ║
║    ✓ Sélection antenne RX/TX (slice set rxant/txant)        ║
║    ✓ Spots sur panadapter (spot add/remove)                 ║
║    ✓ Télémétrie : S-mètre, Power, SWR, ALC, PA Temp        ║
║    ✓ Keepalive (ping toutes les 4s)                         ║
╚══════════════════════════════════════════════════════════════╝

[Flex] Connexion à 192.168.1.42:4992...
[Flex] TCP connecté à 192.168.1.42:4992
[Flex] Version API: 3.4.36.xxxxx
[Flex] Handle client: 0x12345678
[Flex] 18 meters découverts
[Flex] GUI client détecté: handle 0x87654321
[Flex] Session initialisée — prêt
```

---

## Test des fonctions

### 1. Vérifier la connexion

Sur le site DX Hunter → onglet PILOTAGE → Paramètres CAT :
- **État** : Radio connectée (vert)
- **Fréquence** : affiche la fréquence actuelle
- **Version** : "Native API v8.0"

### 2. QSY depuis un spot

Cliquer sur un spot DX → le radio doit changer de fréquence immédiatement.

### 3. Panneau Flex Control

- **Power slider** : déplacer → la puissance change sur le radio
- **TUNE** : cliquer → le radio émet un carrier (voyant TX)
- **MOX** : cliquer → passage en émission
- **NB / NR / ANF / APF** : toggle → le DSP s'active/désactive
- **Filtre** : changer preset → la bande passante change

### 4. Télémétrie

Le panneau doit afficher :
- **S-mètre** : niveau de signal en dBm
- **Puissance** : watts en émission
- **SWR** : ROS en émission
- **ALC** : niveau ALC en émission
- **Temp PA** : température de l'ampli

### 5. Spots panadapter

Activer "Push spots" sur le site → les spots DX apparaissent sur le panadapter SmartSDR avec callsign et fréquence.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|---------------|----------|
| "Port 4992 refusé" | FlexRadio éteint ou mauvaise IP | Vérifier IP et que le Flex est allumé |
| Connecté mais pas de fréquence | Mauvais SLICE_ID | Essayer SLICE_ID=1 |
| Spots ne s'affichent pas | SmartSDR pas lancé | Lancer SmartSDR en parallèle |
| Déconnexion après 30s | Firewall bloque | Vérifier le firewall macOS |
| Télémétrie à 0 | Meters non souscrits | Vérifier les logs (meters découverts) |

### Firewall macOS

Si le Flex refuse la connexion, autorise Node.js dans :
**Préférences Système → Sécurité → Firewall → Options → Autoriser les connexions entrantes pour node**

---

## Quand utiliser v7.1 vs v8.0 ?

| Situation | Bridge recommandé |
|-----------|-------------------|
| En local devant le Flex (même réseau) | **v8.0** (Native API) |
| En déplacement via SmartLink | v7.1 (Kenwood CAT) |
| Pas de SmartSDR installé | **v8.0** (connexion directe) |
| Besoin des spots panadapter | **v8.0** uniquement |
| Besoin de l'EQ / APF | **v8.0** uniquement |

---

## Architecture

```
┌─────────────────┐     TCP 4992      ┌──────────────────┐
│  bridge-relay   │ ←──────────────── │   FlexRadio      │
│  v8.mjs         │ ──────────────→   │   (6400/6600)    │
│                 │  slice/transmit/   │                  │
│                 │  meter/spot cmds   │                  │
└────────┬────────┘                   └──────────────────┘
         │
         │ HTTP POST (tRPC)
         │ every 800ms
         ▼
┌─────────────────┐
│  DX Hunter      │
│  Server         │
│  (cat.push)     │
└────────┬────────┘
         │
         │ tRPC query (polling)
         ▼
┌─────────────────┐
│  DX Hunter      │
│  Web UI         │
│  (FlexControl)  │
└─────────────────┘
```

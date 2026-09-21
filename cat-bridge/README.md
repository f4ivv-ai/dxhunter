# DX Daruma CAT Bridge — Guide d'installation et d'utilisation

**Version** : 2.0 Universal Edition  
**Compatibilité** : Windows, macOS, Linux  
**Auteur** : DX Daruma / F4IVV

---

## Présentation

Le **DX Daruma CAT Bridge** est un petit programme Node.js qui fait le pont entre le site web DX Daruma (votre navigateur) et votre transceiver. Quand vous cliquez sur un spot DX dans l'interface, le Bridge envoie la commande QSY à votre poste qui se cale automatiquement sur la bonne fréquence et le bon mode.

Le Bridge tourne sur votre ordinateur (le même qui affiche DX Daruma dans le navigateur) et communique avec votre transceiver soit par le réseau (FlexRadio), soit par port série/USB (Yaesu, Icom, Kenwood, Elecraft), soit via Hamlib (universel).

---

## Transceivers supportés

| Fabricant | Modèles testés | Protocole | Connexion |
|-----------|---------------|-----------|-----------|
| **FlexRadio** | FLEX-6400, 6400M, 6600, 6600M, 6700, 8400, 8600 | SmartSDR TCP/IP | Réseau Ethernet/Wi-Fi |
| **Yaesu** | FT-991/A, FT-DX10, FT-DX101D/MP, FT-710, FTDX3000, FTDX5000 | CAT (série) | USB ou RS-232 |
| **Icom** | IC-7300, IC-7610, IC-7700, IC-7851, IC-9700, IC-905 | CI-V (série) | USB |
| **Kenwood** | TS-590S/SG, TS-890S, TS-990S, TS-480 | Kenwood (série) | USB ou RS-232 |
| **Elecraft** | K3, K3S, K4, KX3, KX2 | Elecraft (série) | USB |
| **Tout poste** | Tout transceiver supporté par Hamlib | Hamlib rigctld | TCP (localhost) |

---

## Prérequis

### 1. Node.js (obligatoire)

Téléchargez et installez Node.js version 18 ou supérieure :

| Système | Téléchargement |
|---------|---------------|
| Windows | https://nodejs.org → Installer .msi (LTS) |
| macOS | https://nodejs.org → Installer .pkg (LTS) ou `brew install node` |
| Linux | `sudo apt install nodejs npm` (Ubuntu/Debian) ou `sudo dnf install nodejs` (Fedora) |

Pour vérifier l'installation, ouvrez un terminal et tapez :
```
node --version
```
Vous devez voir `v18.x.x` ou supérieur.

### 2. Package serialport (uniquement pour les modes série)

Si vous utilisez un transceiver connecté en USB/série (Yaesu, Icom, Kenwood, Elecraft), installez le package `serialport` :

```bash
cd cat-bridge
npm install serialport
```

> **Note** : Ce package n'est PAS nécessaire pour FlexRadio (réseau) ni pour Hamlib (TCP).

### 3. Driver USB (si nécessaire)

La plupart des transceivers modernes utilisent un chip USB Silicon Labs CP210x ou FTDI. Les drivers sont généralement installés automatiquement, mais si votre port série n'apparaît pas :

| Chip | Driver |
|------|--------|
| Silicon Labs CP210x (Yaesu, Icom) | https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers |
| FTDI FT232 (Kenwood, Elecraft) | https://ftdichip.com/drivers/vcp-drivers/ |

---

## Installation

### Étape 1 — Télécharger le Bridge

Le dossier `cat-bridge/` est inclus dans le projet DX Daruma. Vous pouvez le télécharger :
- Depuis le panneau "Code" de DX Daruma → Download ZIP → extraire le dossier `cat-bridge/`
- Ou copier les fichiers `bridge.mjs` et `package.json` dans un dossier de votre choix

### Étape 2 — Installer les dépendances (mode série uniquement)

```bash
cd cat-bridge
npm install
```

### Étape 3 — Identifier votre port série

#### Windows
Ouvrez le Gestionnaire de périphériques → Ports (COM et LPT). Notez le numéro COM (ex: `COM3`, `COM4`).

#### macOS
Dans le Terminal :
```bash
ls /dev/cu.usb*
```
Vous verrez quelque chose comme `/dev/cu.usbserial-14310` ou `/dev/cu.SLAB_USBtoUART`.

#### Linux
Dans le Terminal :
```bash
ls /dev/ttyUSB* /dev/ttyACM*
```
Vous verrez `/dev/ttyUSB0` ou `/dev/ttyACM0`.

> **FlexRadio** : pas besoin de port série. Notez l'adresse IP de votre Flex (visible dans SmartSDR → Settings → Network, ou sur votre routeur).

---

## Lancement

### FlexRadio (FLEX-6400/6600/6700/8400/8600)

```bash
# Connexion directe par IP
node bridge.mjs --mode flex --radio 192.168.1.100

# Auto-découverte sur le réseau
node bridge.mjs --mode flex --discover

# Spécifier un slice particulier (défaut: 0)
node bridge.mjs --mode flex --radio 192.168.1.100 --slice 1
```

### Yaesu (FT-991, FT-DX10, FT-DX101, FT-710...)

```bash
# macOS
node bridge.mjs --mode yaesu --serial /dev/cu.usbserial-14310 --baud 38400

# Windows
node bridge.mjs --mode yaesu --serial COM3 --baud 38400

# Linux
node bridge.mjs --mode yaesu --serial /dev/ttyUSB0 --baud 38400
```

> **Vitesse série Yaesu** : vérifiez dans le menu de votre poste (Menu → CAT RATE). Valeurs courantes : 4800, 9600, 19200, 38400.

### Icom (IC-7300, IC-7610, IC-7851, IC-9700...)

```bash
# macOS
node bridge.mjs --mode icom --serial /dev/cu.usbserial-14310 --baud 19200 --civ-addr 94

# Windows
node bridge.mjs --mode icom --serial COM4 --baud 19200 --civ-addr 94

# Linux
node bridge.mjs --mode icom --serial /dev/ttyUSB0 --baud 19200 --civ-addr 94
```

> **Adresse CI-V** : chaque modèle Icom a une adresse par défaut. Vérifiez dans le menu du poste (Set → Connectors → CI-V → CI-V Address).

| Modèle | Adresse CI-V (hex) |
|--------|-------------------|
| IC-7300 | 94 |
| IC-7610 | 98 |
| IC-7700 | 74 |
| IC-7851 | 8E |
| IC-9700 | A2 |
| IC-905 | AC |

### Kenwood (TS-590, TS-890, TS-990, TS-480...)

```bash
# macOS
node bridge.mjs --mode kenwood --serial /dev/cu.usbserial-xxx --baud 115200

# Windows
node bridge.mjs --mode kenwood --serial COM3 --baud 115200

# Linux
node bridge.mjs --mode kenwood --serial /dev/ttyUSB0 --baud 115200
```

> **Vitesse série Kenwood** : les TS-890/990 supportent jusqu'à 115200 baud. Les TS-590 sont souvent à 57600 ou 115200.

### Elecraft (K3, K3S, K4, KX3, KX2)

```bash
# macOS
node bridge.mjs --mode elecraft --serial /dev/cu.usbmodem-xxx --baud 38400

# Windows
node bridge.mjs --mode elecraft --serial COM5 --baud 38400

# Linux
node bridge.mjs --mode elecraft --serial /dev/ttyACM0 --baud 38400
```

> **Vitesse série Elecraft** : le K4 supporte jusqu'à 115200, les K3/KX3/KX2 sont généralement à 38400.

### Hamlib rigctld (universel — tout poste supporté par Hamlib)

Si votre poste n'est pas directement supporté, ou si vous utilisez déjà Hamlib, lancez d'abord `rigctld` :

```bash
# Lancer rigctld pour votre poste (exemple IC-7300)
rigctld -m 3073 -r /dev/ttyUSB0 -s 19200 &

# Puis lancer le Bridge
node bridge.mjs --mode hamlib --host 127.0.0.1 --port 4532
```

> **Avantage Hamlib** : supporte plus de 200 modèles de transceivers. Consultez la liste : https://github.com/Hamlib/Hamlib/wiki/Supported-Radios

---

## Utilisation dans DX Daruma

Une fois le Bridge lancé :

1. **Indicateur dans la NavBar** : l'icône radio passe au vert avec le nom du poste détecté
2. **Bouton QSY** : dans le panneau de détail d'un spot (cliquez sur un spot), un bouton vert "QSY" apparaît
3. **Clic → QSY** : votre poste se cale immédiatement sur la fréquence et le mode du spot

### Mapping des modes

Le Bridge traduit automatiquement les modes DX Cluster vers les modes de votre poste :

| Mode DX Cluster | FlexRadio | Yaesu | Icom | Kenwood/Elecraft |
|----------------|-----------|-------|------|-----------------|
| SSB (< 10 MHz) | LSB | LSB | LSB | LSB |
| SSB (≥ 10 MHz) | USB | USB | USB | USB |
| CW | CW | CW | CW | CW |
| FT8 / FT4 | DIGU | DATA-USB | RTTY | DATA |
| RTTY | DIGL | RTTY | RTTY | FSK |
| AM | AM | AM | AM | AM |
| FM | FM | FM | FM | FM |

---

## Scripts de lancement rapide

### Windows — Fichier `start-bridge.bat`

Créez un fichier `start-bridge.bat` dans le dossier `cat-bridge/` :

```batch
@echo off
echo DX Daruma CAT Bridge - Demarrage
echo.

REM --- MODIFIEZ ICI SELON VOTRE POSTE ---
REM Pour FlexRadio :
REM node bridge.mjs --mode flex --radio 192.168.1.100

REM Pour Yaesu :
REM node bridge.mjs --mode yaesu --serial COM3 --baud 38400

REM Pour Icom :
REM node bridge.mjs --mode icom --serial COM4 --baud 19200 --civ-addr 94

REM Pour Kenwood :
REM node bridge.mjs --mode kenwood --serial COM3 --baud 115200

REM Pour Elecraft :
REM node bridge.mjs --mode elecraft --serial COM5 --baud 38400

REM --- Decommentez la ligne correspondant a votre poste ---
node bridge.mjs --mode flex --discover

pause
```

Double-cliquez sur ce fichier pour lancer le Bridge.

### macOS / Linux — Fichier `start-bridge.sh`

Créez un fichier `start-bridge.sh` dans le dossier `cat-bridge/` :

```bash
#!/bin/bash
echo "═══════════════════════════════════════"
echo "  DX Daruma CAT Bridge - Démarrage"
echo "═══════════════════════════════════════"
echo ""

# --- MODIFIEZ ICI SELON VOTRE POSTE ---

# Pour FlexRadio :
# node bridge.mjs --mode flex --radio 192.168.1.100

# Pour FlexRadio (auto-découverte) :
node bridge.mjs --mode flex --discover

# Pour Yaesu :
# node bridge.mjs --mode yaesu --serial /dev/cu.usbserial-14310 --baud 38400

# Pour Icom :
# node bridge.mjs --mode icom --serial /dev/cu.usbserial-14310 --baud 19200 --civ-addr 94

# Pour Kenwood :
# node bridge.mjs --mode kenwood --serial /dev/ttyUSB0 --baud 115200

# Pour Elecraft :
# node bridge.mjs --mode elecraft --serial /dev/ttyACM0 --baud 38400
```

Rendez-le exécutable et lancez-le :
```bash
chmod +x start-bridge.sh
./start-bridge.sh
```

---

## Dépannage

### L'indicateur reste gris (pas de connexion au Bridge)

- Vérifiez que le Bridge tourne bien dans votre terminal (vous devez voir le tableau ASCII avec "DX Daruma CAT Bridge")
- Vérifiez que vous êtes sur le même ordinateur (le Bridge écoute sur `localhost:4993`)
- Si vous utilisez un navigateur avec des extensions de sécurité strictes, autorisez les connexions WebSocket vers `ws://localhost:4993`

### L'indicateur est orange (Bridge connecté, radio non détectée)

**FlexRadio :**
- Vérifiez l'adresse IP du Flex (peut changer si DHCP)
- Vérifiez que SmartSDR n'est pas en mode "exclusive" (un seul client à la fois)
- Essayez `--discover` pour auto-détecter

**Série (Yaesu/Icom/Kenwood/Elecraft) :**
- Vérifiez le port série (il peut changer si vous débranchez/rebranchez le câble USB)
- Vérifiez la vitesse (baud rate) — elle doit correspondre au réglage du poste
- Vérifiez qu'aucun autre logiciel n'utilise le port série (SmartSDR CAT, WSJT-X, N1MM, etc.)
- Sur Linux, ajoutez votre utilisateur au groupe `dialout` : `sudo usermod -aG dialout $USER` puis redémarrez

### Le QSY ne fonctionne pas (pas de changement de fréquence)

- Vérifiez que le CAT est activé dans les menus de votre poste
- **Yaesu** : Menu → CAT → CAT RATE doit correspondre au `--baud`
- **Icom** : Set → Connectors → CI-V → CI-V USB Baud Rate + CI-V Address
- **Kenwood** : Menu → COM → Baud Rate
- **Elecraft** : CONFIG → RS232 → Baud

### Erreur "serialport not found"

Installez le package :
```bash
cd cat-bridge
npm install serialport
```

Sur Linux, vous pourriez aussi avoir besoin de :
```bash
sudo apt install build-essential python3
```

---

## Architecture technique

```
┌─────────────────────┐     WebSocket      ┌──────────────────┐
│   DX Daruma         │◄──────────────────►│   CAT Bridge     │
│   (Navigateur)      │   ws://localhost    │   (Node.js)      │
│                     │       :4993         │                  │
│  • Bouton QSY       │                    │  • Mode flex     │
│  • Indicateur CAT   │                    │  • Mode hamlib   │
│  • Fréquence live   │                    │  • Mode yaesu    │
└─────────────────────┘                    │  • Mode icom     │
                                           │  • Mode kenwood  │
                                           │  • Mode elecraft │
                                           └────────┬─────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                              TCP/IP (4992)    Série USB/RS232   TCP (4532)
                                    │               │               │
                              ┌─────┴─────┐   ┌────┴────┐    ┌────┴────┐
                              │ FlexRadio │   │ Yaesu   │    │ Hamlib  │
                              │ SmartSDR  │   │ Icom    │    │ rigctld │
                              │   API     │   │ Kenwood │    │         │
                              └───────────┘   │ Elecraft│    └─────────┘
                                              └─────────┘
```

---

## Commandes WebSocket (pour développeurs)

Le Bridge accepte les commandes JSON suivantes sur `ws://localhost:4993/ws` :

```json
// QSY — changer de fréquence et mode
{ "action": "qsy", "freq": 14.205, "mode": "USB" }

// Demander le statut actuel
{ "action": "status" }
```

Réponses :
```json
// QSY réussi
{ "type": "qsy-ok", "success": true, "freq": 14.205, "mode": "USB" }

// Statut
{ "type": "status", "connected": true, "radio": "FlexRadio @ 192.168.1.100", "freq": 14.205, "mode": "usb", "mode_bridge": "flex" }

// Changement de fréquence (broadcast)
{ "type": "freq-change", "freq": 14.074, "mode": "digu" }

// Erreur
{ "type": "error", "message": "..." }
```

---

## FAQ

**Q : Puis-je utiliser le Bridge en même temps que WSJT-X ou un logger ?**  
R : Cela dépend. Pour FlexRadio et Hamlib, oui (connexions multiples supportées). Pour les modes série directs, un seul programme peut utiliser le port à la fois. Solution : utilisez Hamlib comme intermédiaire — lancez `rigctld` et connectez à la fois WSJT-X et le Bridge en mode `hamlib`.

**Q : Le Bridge fonctionne-t-il si DX Daruma est sur un autre ordinateur du réseau ?**  
R : Par défaut, le Bridge écoute sur `0.0.0.0:4993`, donc oui. Dans DX Daruma, modifiez l'adresse du Bridge dans les paramètres (à venir) ou utilisez l'IP de la machine qui fait tourner le Bridge au lieu de `localhost`.

**Q : Mon poste n'est pas dans la liste, que faire ?**  
R : Utilisez le mode Hamlib. Hamlib supporte plus de 200 modèles. Installez Hamlib, lancez `rigctld` avec le bon modèle, puis connectez le Bridge en mode `hamlib`.

**Q : Comment connaître le numéro de modèle Hamlib de mon poste ?**  
R : Tapez `rigctl -l | grep "Votre marque"` pour voir la liste. Par exemple : `rigctl -l | grep Yaesu`.

---

## Changelog

- **v2.0** — Édition universelle : support Yaesu, Icom CI-V, Kenwood, Elecraft, Hamlib
- **v1.0** — Version initiale : FlexRadio SmartSDR uniquement

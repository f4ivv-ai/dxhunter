# DX Hunter — Architecture SO2R (Single Operator Two Radios)

## Vue d'ensemble

Station SO2R avec deux FlexRadio (6401 + 8600) pilotés depuis un seul Mac via SmartLink.
Le concept repose sur deux rôles assignés dynamiquement : **RUN** (émission active) et **MULTI** (écoute/recherche).

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAC (SmartLink)                               │
│                                                                       │
│  ┌──────────────┐     ┌──────────────┐                              │
│  │ SmartSDR #1  │     │ SmartSDR #2  │                              │
│  │ Flex 6401    │     │ Flex 8600    │                              │
│  │ Port 5001    │     │ Port 5002*   │                              │
│  └──────┬───────┘     └──────┬───────┘                              │
│         │                     │                                       │
│  ┌──────┴─────────────────────┴──────┐                              │
│  │      Bridge SO2R (Node.js)         │                              │
│  │  - Dual CAT (port A + port B)     │                              │
│  │  - Interlock TX                    │                              │
│  │  - SWAP RUN/MULTI                  │                              │
│  │  - Push HTTP → DX Hunter           │                              │
│  └──────────────┬────────────────────┘                              │
│                  │ HTTP POST                                          │
└──────────────────┼───────────────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   DX Hunter Server   │
        │  (tRPC SO2R router)  │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │   DX Hunter UI       │
        │  Panneau SO2R        │
        │  RUN | MULTI         │
        └─────────────────────┘
```

*Le port de la 2e instance SmartSDR sera déterminé par `lsof` (probablement 5002 ou 5003).

## Rôles RUN / MULTI

| Aspect | RUN (vert) | MULTI (bleu) |
|--------|-----------|-------------|
| Émission | ✅ Autorisée (seul à émettre) | ❌ Bloquée (interlock) |
| Réception | ✅ Active | ✅ Active |
| QSY cluster | ❌ Jamais (protégé) | ✅ Reçoit tous les QSY |
| Indicateur | 🟢 + "RUN" + badge TX | 🔵 + "MULTI" + badge RX |

## Interlock TX

L'interlock est **logiciel** et **obligatoire** :
- Un seul poste peut émettre à la fois (celui marqué RUN)
- Avant d'autoriser TX sur un poste, le bridge vérifie que l'autre est bien en RX
- Si les deux tentent d'émettre → le MULTI est bloqué, seul le RUN passe
- Le SWAP transfère le droit TX d'un poste à l'autre

## Commande SWAP

Le SWAP inverse les rôles RUN ⇄ MULTI :
1. L'ancien RUN devient MULTI (perd le droit TX)
2. L'ancien MULTI devient RUN (gagne le droit TX)
3. L'audio peut optionnellement basculer (L/R swap)

Déclencheurs du SWAP :
- Bouton SWAP dans l'UI
- Raccourci clavier global (Ctrl+Tab ou touche configurable)
- Pédale USB (pédale gauche)
- Commande DXLog (via UDP)

## QSY depuis le cluster

- **Simple clic** sur un spot → QSY envoyé au poste MULTI uniquement
- **Double-clic** sur un spot → QSY MULTI + SWAP immédiat (bascule pour appeler)
- Le poste RUN n'est JAMAIS perturbé par un QSY cluster

## Bridge SO2R — Structure

```javascript
// Configuration
const RADIO_A = { host: "127.0.0.1", port: 5001, name: "Flex 6401" };
const RADIO_B = { host: "127.0.0.1", port: 5002, name: "Flex 8600" };

// État
let roles = { run: "A", multi: "B" };  // ou inversé après SWAP
let radioA = { connected, freq, mode, tx, ... };
let radioB = { connected, freq, mode, tx, ... };

// Interlock
function canTransmit(radio) {
  return roles[radio] === "run" && !otherRadio.tx;
}

// SWAP
function swap() {
  [roles.run, roles.multi] = [roles.multi, roles.run];
  // Bloquer TX sur l'ancien RUN si actif
  if (getRadio(roles.multi).tx) sendCommand(roles.multi, "RX;");
}
```

## Push serveur — Format étendu

Le bridge pousse un état dual :
```json
{
  "radioA": {
    "connected": true,
    "freq": 14.195,
    "mode": "USB",
    "tx": false,
    "name": "Flex 6401",
    "rfPower": 100,
    "nbEnabled": false,
    "filterHi": 2700,
    "filterLo": 100
  },
  "radioB": {
    "connected": true,
    "freq": 21.295,
    "mode": "USB",
    "tx": false,
    "name": "Flex 8600",
    "rfPower": 100,
    "nbEnabled": true,
    "filterHi": 2400,
    "filterLo": 200
  },
  "roles": { "run": "A", "multi": "B" },
  "interlock": { "txAllowed": "A", "txActive": false }
}
```

## Routage audio

Le DAX de chaque Flex est routé vers une sortie audio Mac distincte :
- RUN → canal gauche (ou sortie 1)
- MULTI → canal droit (ou sortie 2)

Options configurables :
- Stéréo (RUN gauche, MULTI droite) — casque ou haut-parleurs
- Mono RUN seul (MULTI muet)
- Mono MULTI seul (RUN muet)
- Tout vers AirPods (mix mono)
- SWAP audio suit le SWAP rôle

Le routage audio est géré par SmartSDR (DAX → sortie Mac), pas par le bridge.
Le bridge peut envoyer une commande pour changer le volume relatif.

## Pédale USB

Pédale double (iKKEGOL ou PCsensor) :
- Pédale gauche → mappée sur touche F13 (ou configurable) → SWAP
- Pédale droite → mappée sur touche F14 (ou configurable) → PTT MULTI momentané

Le bridge écoute les événements clavier globaux (via module `iohook` ou `global-keypress`).

## Compatibilité DXLog

DXLog supporte le SO2R via :
- Protocole UDP (port configurable) pour les commandes radio
- Le bridge peut écouter les commandes DXLog et les relayer vers le bon Flex
- Mapping : DXLog "Radio 1" = RUN, DXLog "Radio 2" = MULTI

## Phases de développement

### Phase 1 : Bridge dual (cette session)
- Connexion simultanée aux 2 ports CAT
- État dual poussé vers le serveur
- Interlock TX basique
- Commande SWAP

### Phase 2 : Interface SO2R
- Panneau dual RUN/MULTI
- Bouton SWAP
- QSY vers MULTI
- Indicateurs visuels

### Phase 3 : Hotkeys + Pédale
- Raccourcis clavier globaux
- Support pédale USB
- Configuration des touches

### Phase 4 : DXLog + Audio
- Intégration DXLog UDP
- Configuration routage audio
- Mode contest complet

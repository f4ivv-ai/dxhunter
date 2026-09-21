# V21 — Architecture Flex Control + Antenna Genius + Push to Pan

## Architecture actuelle du bridge CAT

Le bridge utilise un relay HTTP (compatible serverless Autoscale) :
- **Bridge → Serveur** : POST `cat.push` toutes les 800ms (freq, mode, connected, radio, version). Auth par token.
- **Navigateur → Serveur** : GET polling `cat.state` toutes les 1.5s
- **Navigateur → Bridge** : POST `cat.command` (action: qsy|split|status, freq, mode, slice). Le bridge récupère les commandes pendantes dans la réponse de `cat.push`.

## Extension nécessaire pour V21

### 1. Flex Control Panel
Étendre `cat.push` pour inclure les données supplémentaires du Flex :
```json
{
  "token": "...",
  "connected": true,
  "freq": 14.205,
  "mode": "USB",
  "radio": "FLEX-6600",
  "version": "4.2.1",
  // NOUVEAU :
  "rfPower": 100,       // 0-100 watts
  "tuneActive": false,
  "moxActive": false,
  "nbEnabled": false,
  "nrEnabled": false,
  "anfEnabled": false,
  "rxAnt": "ANT1",
  "txAnt": "ANT1",
  "smeter": -73,        // dBm
  "fwdPower": 0,        // watts
  "swr": 1.0,
  "alc": 0,
  "paTemp": 45
}
```

Étendre `cat.command` avec de nouvelles actions :
```json
{ "action": "setpower", "value": 50 }
{ "action": "tune", "enabled": true }
{ "action": "mox", "enabled": true }
{ "action": "dsp", "param": "nb|nr|anf", "enabled": true }
{ "action": "setant", "type": "rx|tx", "ant": "ANT1|ANT2|XVTR" }
{ "action": "spot", "freq": 14.205, "callsign": "5B4ALX", "color": "0xFF0000" }
```

### 2. Antenna Genius (port TCP 9007, protocole GSCP)
Même pattern : le bridge se connecte au Antenna Genius en TCP, et relaye l'état via un nouveau endpoint `antenna.push` / `antenna.state` / `antenna.command`.

État poussé par le bridge :
```json
{
  "token": "...",
  "connected": true,
  "selectedAnt": 1,     // 1-8
  "antNames": ["20m Yagi", "40m Dipole", "80m Vert", "HF Beam"],
  "bandMap": { "20m": 1, "40m": 2, "80m": 3 }
}
```

Commandes :
```json
{ "action": "select", "port": 2 }
{ "action": "autoband", "enabled": true }
```

### 3. Push to Pan (Spots sur Panadapter)
Utilise la commande `cat.command` avec action "spot" :
```json
{ "action": "spot", "freq": 14.205, "callsign": "5B4ALX", "color": "0x00FF00" }
```
Le bridge traduit en commande SmartSDR API : `spot add rx_freq=14205000 callsign=5B4ALX color=0x00FF00`

## Fichiers à créer
- `client/src/hooks/useFlexControl.ts` — hook pour les commandes avancées Flex
- `client/src/components/FlexControlPanel.tsx` — UI panneau de contrôle
- `client/src/hooks/useAntennaGenius.ts` — hook pour Antenna Genius
- `client/src/components/AntennaGeniusWidget.tsx` — UI widget antennes
- `server/routers/catRelay.ts` — étendre avec les nouveaux champs push + commandes
- `server/routers/antennaRelay.ts` — nouveau router pour Antenna Genius

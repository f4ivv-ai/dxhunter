# Slice Master 6000 — Analyse pour DX Hunter

## Architecture de Slice Master 6000 (K1DBO)

Slice Master 6000 communique **directement avec le FlexRadio via l'API native TCP 4992** (pas via CAT/Kenwood). C'est la même approche que notre bridge-relay-v8.mjs.

### Fonctionnalités clés pertinentes pour DX Hunter :

1. **Spots sur le panadapteur SSDR** — Slice Master agrège les spots de multiples sources (CW Skimmer, WSJT-X, clusters telnet, N1MM+, SpotCollector) et les affiche directement sur les panafalls SmartSDR via la commande `spot add`.

2. **Bandmap overlay** — Superpose un bandmap sur les fenêtres pop-out panafall de SmartSDR. Double-clic sur un spot = QSY du slice vers cette fréquence.

3. **Mixer audio** — Solo, mute, AGC, sidetone, monitor, et presets de niveau par slice. Contrôle via `slice s <id> audio_level=<0-100>`.

4. **HRD TCP Listener** — Fournit un listener TCP par slice pour les programmes externes (loggers, DM780). Supporte le suivi TX.

5. **TCP CAT Listener** — Compatible hamlib, un listener par slice.

6. **Synchronisation slices** — Follow frequency, panadapter center/zoom/scale entre slices.

7. **Status Broadcast** — Protocoles kpa500, kat500, hfauto, radioinfo, meter pour piloter des amplis et accessoires externes.

## Implications pour DX Hunter

### Spots sur panadapteur — CONFIRMÉ : nécessite API native (port 4992)

Slice Master confirme que les spots sur le panadapteur passent **exclusivement par l'API native FlexRadio** :
- Commande : `spot add rx_freq=<MHz> callsign=<call> color=<hex_ARGB> source=<src> lifetime_seconds=<sec>`
- Nécessite un client GUI ou un binding à un client GUI existant
- SmartSDR DOIT être en cours d'exécution

### Ce que ça signifie pour notre bridge SO2V (CAT port 5001) :

Le bridge SO2V utilise le protocole Kenwood CAT via SmartSDR CAT (port 5001). Ce protocole **ne supporte PAS** les spots sur le panadapteur. C'est une limitation fondamentale du protocole CAT.

### Options pour les spots :

1. **Bridge hybride** : Le bridge SO2V continue de gérer les commandes CAT (QSY, filtres, MUTE, etc.) ET ouvre une connexion parallèle sur le port 4992 uniquement pour les spots. Nécessite que SmartSDR soit en cours d'exécution (ce qui est le cas).

2. **Passer entièrement à l'API native** : Abandonner le CAT et utiliser exclusivement le port 4992 comme bridge-relay-v8.mjs. Plus puissant mais plus complexe.

3. **Utiliser Slice Master 6000 comme intermédiaire** : DX Hunter envoie les spots à Slice Master via son serveur telnet d'agrégation, et Slice Master les affiche sur le panadapteur.

### Recommandation : Option 1 (Bridge hybride)

Le bridge SO2V garde sa connexion CAT pour les commandes classiques, et ajoute une connexion TCP 4992 parallèle pour :
- `spot add` / `spot remove` (spots sur panadapteur)
- Éventuellement : telemetry (S-meter, FWD power, SWR) via `sub meter all`
- Éventuellement : EQ RX (`eq rxsc`)

La connexion native doit :
1. Se connecter au port 4992
2. Envoyer `client program DXHunter`
3. Trouver le handle GUI de SmartSDR via les status messages
4. Se binder : `client bind client_id=<gui_handle>`
5. Ensuite les commandes `spot add` fonctionneront

## Commandes Slice Master vs DX Hunter Bridge

| Fonctionnalité | Slice Master | DX Hunter (CAT) | DX Hunter (natif v8) |
|---|---|---|---|
| QSY slice | API native | FA/FB ✅ | slice t ✅ |
| Mode | API native | MD ✅ | slice s mode= ✅ |
| Spots panadapteur | spot add ✅ | ❌ impossible | spot add ✅ |
| Mute/Volume | API native | AG0 ✅ | slice s audio_level= ✅ |
| NB/NR/ANF | API native | NB/NR/NT ✅ | slice s nb=/nr=/anf= ✅ |
| Filtre | API native | SL/SH ✅ | filt <id> lo hi ✅ |
| TUNE | transmit tune | TX/RX ⚠️ | transmit tune ✅ |
| Antenne RX/TX | API native | AN ⚠️ | slice s txant=/rxant= ✅ |
| EQ | API native | ❌ | eq rxsc ✅ |
| S-meter | meter sub | SM ⚠️ | sub meter ✅ |
| Puissance | API native | PC ✅ | transmit set rfpower= ✅ |

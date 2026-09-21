# DX Hunter — Guide de test Bridge Relay v7.1 (Kenwood CAT + SmartLink)

## Architecture

Le bridge v7.1 utilise le **protocole Kenwood CAT** exposé par SmartSDR for Mac (port 5001) au lieu de l'API native Flex (port 4992). Cela le rend **compatible SmartLink** car SmartSDR Mac/Win gère la connexion distante au FlexRadio et expose un port CAT local.

```
┌─────────────────┐                         ┌──────────────────┐
│   FlexRadio     │◄── SmartLink (cloud) ──►│  SmartSDR Mac    │
│   (distant)     │                         │  (v2.9.132)      │
└─────────────────┘                         └────────┬─────────┘
                                                     │ TCP 5001
                                                     │ (Kenwood CAT)
                                                     ▼
                                            ┌──────────────────┐
                                            │   Bridge v7.1    │     HTTPS POST
                                            │   (Node.js)      │────────────────►  DX Hunter
                                            │                  │◄────────────────  (serveur)
                                            └────────┬─────────┘    commandes
                                                     │
                                                     │ TCP 9007 (optionnel)
                                                     ▼
                                            ┌──────────────────┐
                                            │  Antenna Genius  │
                                            │  (4O3A)          │
                                            └──────────────────┘
```

---

## Prérequis

- **Node.js 18+** installé sur le Mac (pas de `npm install` nécessaire, modules natifs uniquement)
- **SmartSDR for Mac v2.9.132** lancé et connecté au Flex via SmartLink
- Le port CAT Kenwood doit être activé dans SmartSDR (port 5001 par défaut)
- **Antenna Genius** connecté au réseau local (optionnel)
- **Accès réseau** : le Mac doit pouvoir joindre le serveur DX Hunter (HTTPS)

---

## 1. Configuration

Éditer le fichier `start-bridge-v7.sh` :

```bash
# SmartSDR CAT port (localhost car SmartSDR tourne sur ce Mac)
export CAT_HOST="127.0.0.1"
export CAT_PORT="5001"

# Antenna Genius (si disponible sur le réseau local)
export AG_HOST="192.168.1.YYY"      # ← IP de l'AG
export AG_PORT="9007"
export AG_ENABLED="false"           # "true" pour activer

# URL du serveur DX Hunter
export SERVER_URL="https://dxclusterf4ivv.manus.space"

# Token d'authentification
export TOKEN="<votre-jeton-secret-24-caracteres-minimum>"
```

### Vérifier que le port CAT est actif

Dans SmartSDR for Mac :
1. Ouvrir les **Préférences** (ou Settings)
2. Section **CAT** ou **Serial/CAT**
3. Vérifier que le port Kenwood est activé sur **5001**
4. Si le port est différent, adapter `CAT_PORT` dans le script

Test rapide depuis le Terminal :
```bash
nc -z 127.0.0.1 5001 && echo "Port 5001 OK" || echo "Port 5001 fermé"
```

---

## 2. Lancement

```bash
cd cat-bridge/
chmod +x start-bridge-v7.sh
./start-bridge-v7.sh
```

Tu devrais voir :

```
╔══════════════════════════════════════════════════════════════╗
║  DX HUNTER — Bridge Relay v7.1 (Kenwood CAT + SmartLink)   ║
╠══════════════════════════════════════════════════════════════╣
║  CAT        : 127.0.0.1:5001 (Kenwood protocol)            ║
║  Ant Genius : DÉSACTIVÉ                                     ║
║  Serveur    : https://dxclusterf4ivv.manus.space            ║
║  Token      : dxhunte...                                    ║
╠══════════════════════════════════════════════════════════════╣
║  Fonctions (via Kenwood CAT) :                             ║
║    ✓ Fréquence, mode, QSY                                  ║
║    ✓ Power (PC), TUNE (AC), MOX (TX/RX)                    ║
║    ✓ DSP : NB, NR, ANF                                     ║
║    ✓ Filtre passe-bande (SL/SH)                            ║
║    ✓ RF Gain (AG)                                           ║
║    ✓ Télémétrie : S-mètre (SM), Power (RM5), SWR (RM1)    ║
║    ✗ APF, EQ 8 bandes (non dispo via Kenwood CAT)          ║
║    ✗ Spots panadapter (non dispo via Kenwood CAT)           ║
║    ✗ Sélection antenne RX/TX (limité)                       ║
╚══════════════════════════════════════════════════════════════╝

[Info] Compatible SmartLink — passe par SmartSDR Mac/Win port 5001

[CAT] Connexion à 127.0.0.1:5001...
[CAT] Connecté à 127.0.0.1:5001 (Kenwood CAT)
```

---

## 3. Vérifications

### 3.1 Connexion CAT (TCP 5001)

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `Port 5001 refuse — SmartSDR CAT actif ?` | SmartSDR pas lancé ou CAT désactivé | Lancer SmartSDR, activer le port CAT |
| `Timeout, reconnexion...` | SmartSDR déconnecté du Flex | Vérifier la connexion SmartLink |
| `ECONNREFUSED` | Port CAT pas sur 5001 | Vérifier le port dans les préférences SmartSDR |
| Connecté mais pas de fréquence | SmartSDR pas connecté au Flex | Se connecter au radio dans SmartSDR |

**Test rapide** : Tourner le VFO dans SmartSDR → la fréquence doit changer dans DX Hunter (indicateur header vert).

### 3.2 Commandes Kenwood CAT supportées

| Action dans DX Hunter | Commande CAT | Vérification |
|----------------------|--------------|--------------|
| Clic sur un spot (QSY) | `FA00014205000;` | Le VFO bouge dans SmartSDR |
| Slider Power → 50W | `PC050;` | Puissance change dans SmartSDR |
| Bouton TUNE | `AC111;` | Le Flex passe en TUNE |
| Bouton MOX | `TX;` / `RX;` | TX/RX dans SmartSDR |
| Toggle NB ON | `NB1;` | NB s'allume dans SmartSDR |
| Toggle NR ON | `NR1;` | NR s'allume dans SmartSDR |
| Toggle ANF ON | `NT1;` | Notch auto dans SmartSDR |
| Filtre 300-2400 Hz | `SL0300;` `SH2400;` | Filtre change dans SmartSDR |
| RF Gain +12 dB | `AG0127;` | RF Gain change dans SmartSDR |

### 3.3 Télémétrie

Une fois connecté, le bridge poll automatiquement :
- **S-mètre** (SM0) → affiché dans le panneau Flex
- **Puissance forward** (RM5) → en émission
- **ROS/SWR** (RM1) → en émission
- **ALC** (RM3) → en émission

### 3.4 Fonctions NON disponibles via Kenwood CAT

Ces fonctions nécessitent l'API native Flex (port 4992) qui n'est pas accessible via SmartLink :

| Fonction | Raison | Contournement |
|----------|--------|---------------|
| APF (Audio Peak Filter) | Pas de commande Kenwood | Activer manuellement dans SmartSDR |
| Égaliseur RX 8 bandes | Pas de commande Kenwood | Régler dans SmartSDR directement |
| Spots sur panadapter | Nécessite API VITA-49 | Utiliser DX Hunter pour voir les spots |
| Sélection antenne RX/TX | Commande AN limitée | Utiliser SmartSDR ou Antenna Genius |

### 3.5 Antenna Genius (TCP 9007, optionnel)

Si `AG_ENABLED=true` :

| Symptôme | Cause | Solution |
|----------|-------|----------|
| `Port 9007 refuse` | AG pas allumé ou mauvaise IP | Vérifier alimentation et IP |
| Connecté mais pas de noms | Firmware ancien | Mettre à jour firmware 4O3A |

**Note SmartLink** : L'Antenna Genius est sur le réseau local du shack. Si tu es en remote (SmartLink), l'AG n'est pas accessible sauf si tu as un VPN vers le réseau du shack.

---

## 4. Lancement automatique (macOS)

### Via launchd (recommandé)

Créer le fichier `~/Library/LaunchAgents/com.dxhunter.bridge.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dxhunter.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/TONUSER/dx_hunter/cat-bridge/bridge-relay-v7.mjs</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/TONUSER/dx_hunter/cat-bridge</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>SERVER_URL</key>
        <string>https://dxclusterf4ivv.manus.space</string>
        <key>TOKEN</key>
        <string><votre-jeton-secret></string>
        <key>CAT_HOST</key>
        <string>127.0.0.1</string>
        <key>CAT_PORT</key>
        <string>5001</string>
        <key>AG_ENABLED</key>
        <string>false</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/dxhunter-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/dxhunter-bridge.err</string>
</dict>
</plist>
```

```bash
# Charger le service
launchctl load ~/Library/LaunchAgents/com.dxhunter.bridge.plist

# Vérifier qu'il tourne
launchctl list | grep dxhunter

# Voir les logs
tail -f /tmp/dxhunter-bridge.log
```

---

## 5. Dépannage

### Le bridge se connecte mais pas de données

1. Vérifier que SmartSDR affiche un slice actif et est connecté au Flex
2. Tester manuellement : `echo "IF;" | nc 127.0.0.1 5001` — doit retourner une réponse IF...;
3. Vérifier que le port CAT est bien 5001 (pas un autre port)

### Les commandes ne passent pas

1. Vérifier les logs du bridge : `[CAT] QSY → 14.205 MHz` doit apparaître
2. Si "Commande ignorée (non connecté)" → le bridge a perdu la connexion
3. Certaines commandes peuvent ne pas être supportées par la version de SmartSDR

### Valeurs de filtre incorrectes

SmartSDR for Mac peut retourner les valeurs SH/SL différemment selon la version :
- Certaines versions retournent des **index** (0-11) au lieu de Hz
- D'autres retournent directement les Hz

Si les filtres ne fonctionnent pas correctement, noter les valeurs retournées par `SH;` et `SL;` et me les communiquer pour ajuster le mapping.

### Commande TUNE (AC) ne fonctionne pas

Le comportement de la commande AC varie selon les versions de SmartSDR :
- `AC111;` = Tuner ON + Start tune (standard Kenwood)
- Si ça ne marche pas, essayer `AC011;` ou simplement `TX;` avec power réduit

### Latence

Le bridge poll toutes les 500ms et push toutes les 800ms. Latence totale typique : 1-2 secondes.
Pour réduire : modifier `POLL_INTERVAL_MS` et `PUSH_INTERVAL_MS` dans le code.

---

## 6. Sécurité

- Le token (24 caractères minimum, jamais publié) est un secret partagé entre le bridge et le serveur
- Le bridge n'ouvre aucun port en entrée (il initie toutes les connexions)
- Communications serveur chiffrées (HTTPS)
- Le bridge n'exécute que les commandes reconnues (whitelist dans `executeCommand`)
- Le port CAT 5001 est local (127.0.0.1) — pas d'exposition réseau

---

## 7. Résumé des différences v7.0 → v7.1

| Aspect | v7.0 (ancien) | v7.1 (actuel) |
|--------|---------------|---------------|
| Protocole | API native Flex (VITA-49) | Kenwood CAT |
| Port | TCP 4992 | TCP 5001 |
| SmartLink | ❌ Non compatible | ✓ Compatible |
| Connexion | Directe au Flex | Via SmartSDR Mac |
| APF | ✓ | ❌ (pas via Kenwood) |
| EQ 8 bandes | ✓ | ❌ (pas via Kenwood) |
| Spots panadapter | ✓ | ❌ (pas via Kenwood) |
| Antenne RX/TX | ✓ | Limité (AN command) |
| Fréquence/Mode | ✓ | ✓ |
| Power/TUNE/MOX | ✓ | ✓ |
| NB/NR/ANF | ✓ | ✓ |
| Filtre lo/hi | ✓ | ✓ |
| RF Gain | ✓ | ✓ |
| S-mètre | ✓ | ✓ |
| SWR/ALC/Power | ✓ | ✓ |

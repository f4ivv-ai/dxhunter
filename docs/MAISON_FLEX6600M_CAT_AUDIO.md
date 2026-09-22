# Maison — FLEX-6600M, DX Hunter, CAT et audio sur MacBook Pro

Cette étape transforme le bridge Maison du **FLEX-6600M** en poste de pilotage **réception seulement**. DX Hunter peut afficher les mesures du Flex et envoyer un QSY ou des réglages de réception. L’émission reste protégée à trois niveaux : le bridge local, le relais DX Hunter et SmartSDR for Mac.

> Le MacBook Pro est le poste de pilotage. SmartSDR for Mac pilote l’audio réel. DX Hunter pilote uniquement la télémétrie et les commandes CAT autorisées. Le bridge ne modifie jamais les réglages audio macOS ni les périphériques CoreAudio.

## Architecture de la phase Maison

```text
Micro Gamer ──> SmartSDR for Mac ──> FLEX-6600M
                       │                    │
Mac speakers / casque <─┘                    │ SmartSDR API TCP 4992
                                            │
DX Hunter <── HTTPS authentifié ── bridge Maison sur le MacBook Pro
```

Le bridge se connecte directement à l’API native SmartSDR du FLEX-6600M sur le réseau local. Il n’a pas besoin d’un port CAT virtuel pour DX Hunter. SmartSDR for Mac doit néanmoins rester ouvert lorsque vous souhaitez voir les panadaptères ou utiliser le son sur le MacBook Pro.

## Les trois niveaux CAT

| Mode dans `maison-flex-6600m.env` | Actions autorisées                                           | Actions bloquées                                        |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `monitor`                         | Télémétrie : fréquence, mode, DSP, S-mètre, ROS, température | Toutes les commandes, dont QSY                          |
| `receive`                         | QSY, DSP RX, filtres, gain RX, égalisation RX et spots       | PTT, MOX, TUNE, puissance, antennes, Split/XIT          |
| `operate`                         | À définir ultérieurement après validation matérielle         | MOX/TUNE restent bloqués sauf autorisation TX distincte |

La phase demandée utilise **`receive`**. C’est le seul mode qui permet à DX Hunter de faire suivre un spot et de régler le confort de réception sans créer une voie d’émission.

## Configurer SmartSDR for Mac avant CAT

Connecter le MacBook Pro et le FLEX-6600M au même réseau local, de préférence en Ethernet. Ouvrir SmartSDR for Mac, sélectionner le FLEX-6600M Maison, créer ou sélectionner le slice de réception prévu pour DX Hunter, puis vérifier que la fréquence et le mode se mettent à jour dans SmartSDR.

Dans les réglages Audio de SmartSDR for Mac, commencer par cocher **Listen only mode**. Cette option évite toute utilisation du microphone pendant la phase de réception. Sélectionner ensuite la sortie d’écoute réelle. Pour connaître les noms exacts macOS des périphériques présents :

```bash
system_profiler SPAudioDataType
```

Ne supposez pas que le périphérique est nommé « Micro Gamer » : copiez son nom exact depuis macOS ou SmartSDR for Mac dans le profil ci-dessous.

## Choisir un profil audio

Le profil est déclaratif : il sert à afficher dans DX Hunter la configuration prévue. L’audio est réellement sélectionné dans SmartSDR for Mac.

| Profil                      | Audio SmartSDR for Mac                                                                      | Usage                                     | Valeurs à déclarer dans le bridge                            |
| --------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `micro-gamer-casque`        | Sortie : casque ou interface Micro Gamer ; entrée : Micro Gamer ; **Listen only** coché     | Écoute de réception au casque             | `AUDIO_PROFILE`, `AUDIO_OUTPUT_DEVICE`, `AUDIO_INPUT_DEVICE` |
| `micro-gamer-haut-parleurs` | Sortie : haut-parleurs Mac ; entrée : Micro Gamer ; **Listen only** coché                   | Écoute locale au MacBook Pro              | mêmes variables                                              |
| `dax-reception-numerique`   | DAX Streaming et pilote Common-Radio configurés ; sortie/entrée selon le logiciel numérique | Décodage numérique et réception appliquée | `AUDIO_DAX_ENABLED="true"` et profil dédié                   |

Pour commencer avec le micro gamer connecté au MacBook Pro et une écoute au casque, renseigner les noms matériels dans le fichier de bridge, mais garder l’écoute seule active :

```bash
nano ~/.config/dxhunter/maison-flex-6600m.env
```

```bash
OPERATION_MODE="receive"
ALLOW_TX_CONTROL="false"
AUDIO_PROFILE="micro-gamer-casque"
AUDIO_INPUT_DEVICE="NOM EXACT DU MICRO GAMER"
AUDIO_OUTPUT_DEVICE="NOM EXACT DU CASQUE OU DE L’INTERFACE"
AUDIO_DAX_ENABLED="false"
AUDIO_LISTEN_ONLY="true"
```

Le nom de l’entrée est déclaré pour documenter la station ; **Listen only mode** dans SmartSDR for Mac doit rester coché. Aucun son de microphone ne doit atteindre le Flex dans cette phase.

## Installer ou mettre à jour le bridge CAT Maison

Le bridge utilise `CAT_BRIDGE_TOKEN`, déjà configuré dans le backend DX Hunter et stocké localement sous `dxhunter-maison-cat` dans le Trousseau macOS. Une fois le fichier mis à jour, réinstaller puis redémarrer le service :

```bash
cd ~/src/dxhunter/cat-bridge
./install-maison-autostart.sh
launchctl kickstart -k gui/$(id -u)/com.dxhunter.maison-flex-6600m
```

Lire le log :

```bash
tail -f ~/dxhunter-bridge/maison-flex-6600m.log
```

La sortie attendue indique **PILOTAGE RX** et précise que QSY et réglages RX sont autorisés, mais que TX, TUNE et puissance restent bloqués.

## Vérifier DX Hunter sans émission

Ouvrir DX Hunter avec un compte administrateur. Le panneau CAT doit afficher :

- **Maison · FLEX-6600M** et une fréquence réelle ;
- **CAT : QSY + réglages RX** ;
- le profil audio déclaré ;
- **Protection TX : Bloquée** ;
- **Écoute seule** et l’état DAX choisi.

Tester ensuite un QSY vers un spot. SmartSDR for Mac doit changer la fréquence du slice configuré. Aucun voyant TX ne doit s’allumer sur le Flex. Confirmer aussi qu’un appui sur les contrôles de réception de DX Hunter modifie uniquement le filtre, le noise blanker, la réduction de bruit ou les paramètres RX.

Ne pas tester TUNE, MOX, puissance RF, Split ou sélection d’antenne au cours de cette étape. Ces commandes sont rejetées par DX Hunter et par le bridge lorsque le mode vaut `receive`.

## DAX et logiciels numériques

DAX Streaming sert à transmettre un flux audio entre le Flex et un logiciel externe. SmartSDR for Mac indique que cette fonction nécessite le pilote Common-Radio Audio. Pour la station Maison, ne l’activer que lorsque vous utilisez un logiciel numérique compatible et après avoir identifié la paire de canaux DAX du slice. Ne partagez pas le même flux DAX entre un logiciel numérique et une autre source sans vérifier les niveaux et le routage.

Le profil `dax-reception-numerique` reste une intégration de **réception**. L’activation DAX ne modifie pas les protections CAT : `OPERATION_MODE="receive"`, `ALLOW_TX_CONTROL="false"` et Listen only restent applicables.

## Étape suivante après validation

Après validation du QSY et de l’audio de réception, on pourra intégrer une deuxième source audio ou un second Flex pour le SO2R. La règle cible reste : deux réceptions distinctes, routables vers casque, AirPods ou haut-parleurs, avec interverrouillage avant toute émission.

## Références

[1]: https://documents.roskosch.de/smartsdr-mac/ "SmartSDR for Mac — Software User Guide"
[2]: https://www.flexradio.com/api/developer-program/ "FlexRadio Developer Program and SmartSDR API"
[3]: https://common-radio.com/ "Common-Radio Audio Interface"
[4]: https://support.apple.com/fr-fr/guide/mac-help/mchlp2567/mac "Apple — Réglages audio sur Mac"

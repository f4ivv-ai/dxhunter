# Mise en service Maison — FLEX-6600M en lecture seule

Cette procédure met en service la première station de DX Hunter : **Maison**, équipée d’un **FLEX-6600M**. Elle installe sur le MacBook Pro un bridge qui démarre automatiquement à chaque ouverture de session et se reconnecte au Flex sur le réseau local.

La première étape est volontairement limitée à la **télémétrie en lecture seule**. Le bridge remonte la fréquence, le mode, les états RX/TX, les antennes annoncées par le Flex, le niveau S-mètre, la puissance directe, le ROS, l’ALC et la température PA lorsque les mesures sont disponibles. Il n’exécute ni QSY, ni changement de DSP, ni changement d’antenne, ni TUNE, ni MOX.

> **Important :** le service `Maison` ne doit être installé que sur le MacBook Pro réellement utilisé par l’opérateur, connecté au même réseau local que le FLEX-6600M. Il ne publie aucun port vers Internet. Le token reste exclusivement dans le Trousseau macOS.

## Préparation

Le MacBook Pro doit disposer de Node.js 18 ou plus récent. Il faut également connaître l’adresse IPv4 locale du FLEX-6600M. Cette adresse peut être lue dans SmartSDR ou sur l’écran de la radio. Ne pas envoyer cette adresse dans une discussion publique ou la placer dans GitHub.

Copier le dossier `cat-bridge` de DX Hunter sur le MacBook Pro, par exemple dans `~/dxhunter-source/cat-bridge`. Dans ce dossier, rendre les scripts exécutables :

```bash
chmod +x start-maison-flex-6600m.sh install-maison-autostart.sh
```

## Configuration locale

L’installateur crée le fichier `~/.config/dxhunter/maison-flex-6600m.env` au premier lancement. Après cette création, ouvrir ce fichier et remplacer uniquement :

```bash
FLEX_IP="CHANGE_ME"
```

par l’adresse locale du FLEX-6600M. Laisser impérativement les deux lignes suivantes dans leur état initial :

```bash
OPERATION_MODE="monitor"
ALLOW_TX_CONTROL="false"
```

Le mode `monitor` bloque toutes les commandes sortantes vers le Flex. Cette première connexion ne peut donc pas modifier la fréquence, lancer un accord, activer MOX ou sélectionner une antenne.

## Stockage du jeton dans le Trousseau macOS

Le bridge utilise le même jeton privé que le serveur DX Hunter attend dans `CAT_BRIDGE_TOKEN`. L’enregistrer sans l’écrire dans l’historique du shell ni dans le fichier de configuration :

```bash
read -s 'TOKEN?Jeton CAT : '; echo
security add-generic-password -U -a "$USER" -s "dxhunter-maison-cat" -w "$TOKEN"
unset TOKEN
```

Le jeton doit comporter au moins 24 caractères. La valeur est lue au démarrage directement depuis le Trousseau macOS.

## Installation du démarrage automatique

Après avoir renseigné `FLEX_IP` et le jeton, exécuter :

```bash
./install-maison-autostart.sh
```

L’installateur place les composants dans `~/dxhunter-bridge`, installe le service `com.dxhunter.maison-flex-6600m` dans `~/Library/LaunchAgents` et le démarre immédiatement. Il redémarrera automatiquement au prochain login du MacBook Pro.

## Vérification sans émission

Attendre une dizaine de secondes puis ouvrir DX Hunter. Le panneau CAT doit afficher **Maison · FLEX-6600M**, la fréquence actuelle et la mention **Bloquée — lecture seule**. Dans le terminal, consulter les logs :

```bash
tail -f ~/dxhunter-bridge/maison-flex-6600m.log
```

La sortie recherchée est une connexion TCP au port 4992, l’identification du Flex et l’initialisation de la session. Aucun test TUNE, MOX ou PTT ne fait partie de cette phase.

La commande suivante confirme que le service launchd est chargé :

```bash
launchctl print gui/$(id -u)/com.dxhunter.maison-flex-6600m
```

## Actions ultérieures

Une fois la télémétrie validée, la phase suivante est le mode CAT `receive` avec le profil audio SmartSDR for Mac déclaré dans DX Hunter. Cette phase autorise QSY et réglages RX mais pas l’émission. Consulter [`MAISON_FLEX6600M_CAT_AUDIO.md`](MAISON_FLEX6600M_CAT_AUDIO.md) avant de modifier le fichier de configuration. L’intégration ARCO est documentée séparément dans [`MAISON_ARCO_READONLY.md`](MAISON_ARCO_READONLY.md). Le passage à une capacité d’émission reste exclu tant que la configuration matérielle et les interverrouillages n’ont pas été validés explicitement.

## Arrêt et désinstallation

Pour arrêter le bridge :

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.dxhunter.maison-flex-6600m.plist
```

Pour le retirer complètement, arrêter le service puis supprimer son fichier plist. Le fichier de configuration et le jeton restent en place afin de ne pas les supprimer accidentellement.

## Références

[1]: https://www.flexradio.com/api/developer-program/ "FlexRadio SmartSDR Application Programming Interfaces"
[2]: https://support.apple.com/guide/keychain-access/welcome/mac "Apple Keychain Access User Guide"

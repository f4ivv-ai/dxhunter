# Mise en service Maison — microHAM ARCO en lecture seule

Cette procédure raccorde le ou les pupitres **microHAM ARCO** de la station **Maison** à DX Hunter. Elle vient après la mise en service lecture seule du FLEX-6600M. L’objectif est d’abord d’afficher la position réellement remontée par ARCO, son état de connexion et les défauts éventuels, tout en empêchant tout mouvement distant.

> **Principe de sûreté :** l’ARCO reste autonome au pupitre. DX Hunter ne contacte jamais le contrôleur ou le serveur VNC par Internet. Le MacBook Pro exécute un bridge local qui ne communique qu’avec un adaptateur ARCO également local. Le mode de départ est `monitor` et bloque tout déplacement.

## Préconditions

Le MacBook Pro doit être sur le réseau local de Maison. L’adaptateur ARCO déjà existant doit être accessible uniquement sur la boucle locale du MacBook Pro et proposer ces opérations : `rotator.getState`, `rotator.goTo` et `rotator.stop`. La configuration ARCO elle-même, son adresse réseau et ses identifiants restent locaux ; ils ne doivent être placés ni dans GitHub ni dans l’interface DX Hunter.

Le serveur DX Hunter doit recevoir une nouvelle variable secrète `ARCO_BRIDGE_TOKEN`, distincte du token CAT et d’au moins 24 caractères. Le bridge Maison utilisera exactement ce token, stocké dans le Trousseau macOS sous le nom `dxhunter-maison-arco`.

## Configuration locale

Depuis le dossier `cat-bridge` du projet DX Hunter, préparer les scripts :

```bash
chmod +x start-maison-arco.sh install-maison-arco-autostart.sh
```

Le premier lancement de l’installateur crée le fichier privé suivant :

```text
~/.config/dxhunter/maison-arco.env
```

Dans ce fichier, renseigner `ARCO_ADAPTER_URL` avec l’URL de l’adaptateur qui écoute sur le MacBook Pro, par exemple sous la forme suivante :

```bash
ARCO_ADAPTER_URL="http://127.0.0.1:PORT/api/trpc"
```

Le bridge refuse une adresse qui n’est pas `localhost`, `127.0.0.1` ou `::1`. Cette restriction évite qu’une adresse ARCO de Maison soit exposée ou appelée depuis l’extérieur.

Conserver impérativement :

```bash
OPERATION_MODE="monitor"
ALLOW_ARCO_MOTION="false"
```

## Jeton ARCO dans le Trousseau macOS

Après avoir configuré le secret `ARCO_BRIDGE_TOKEN` côté serveur DX Hunter, l’enregistrer localement sans l’écrire dans un fichier ou l’historique :

```bash
read -s 'TOKEN?Jeton ARCO : '; echo
security add-generic-password -U -a "$USER" -s "dxhunter-maison-arco" -w "$TOKEN"
unset TOKEN
```

## Installation du démarrage automatique

Renseigner d’abord l’URL locale de l’adaptateur, puis exécuter :

```bash
./install-maison-arco-autostart.sh
```

Le service macOS `com.dxhunter.maison-arco` démarre au login et se reconnecte automatiquement. Les logs sont disponibles ici :

```bash
tail -f ~/dxhunter-bridge/maison-arco.log
```

## Vérification sans mouvement

Ouvrir DX Hunter et vérifier le widget **Maison · ARCO**. Il doit indiquer l’azimut mesuré, l’état de l’adaptateur et la bannière **Lecture seule**. Tous les boutons de direction et de saisie doivent être désactivés. Le bouton `STOP` peut être disponible lorsque le bridge est vivant : il ne provoque jamais un mouvement, il tente seulement d’interrompre une action éventuelle.

La position affichée est une position confirmée par l’adaptateur local. Si l’adaptateur est hors ligne, DX Hunter doit l’indiquer comme indisponible, jamais comme une position valide.

## Passage ultérieur au mouvement explicite

Le mouvement distant ne doit être envisagé qu’après vérification du sens de rotation, des limites, du parcage, des antennes associées, des zones interdites, de la priorité du pupitre local et des interverrouillages RF. Il faut alors modifier simultanément :

```bash
OPERATION_MODE="operate"
ALLOW_ARCO_MOTION="true"
```

Cette étape doit rester distincte de toute capacité d’émission. Elle ne sera pas activée automatiquement par DX Hunter, par une fréquence Flex, par un spot DX ou par un ordre provenant de DXLog.

## Références

[1]: http://www.microham.com/contents/en-us/d50_ARCO.html "microHAM ARCO Smart Antenna Rotator Controller"
[2]: https://static.dxengineering.com/global/images/instructions/moh-arco-115v_lg.pdf "microHAM ARCO Controller Manual"

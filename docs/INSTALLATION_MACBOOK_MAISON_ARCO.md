# MacBook Pro — configuration et lancement du bridge ARCO Maison

Ce guide installe le bridge **DX Hunter / ARCO Maison** sur le MacBook Pro de l’opérateur. Le service macOS démarre à chaque ouverture de session et remonte uniquement la position et l’état du pupitre ARCO. Dans cette première configuration, **tout mouvement distant est bloqué**.

> **Ne pas utiliser l’ancienne application rotor exposée sur Internet pour ce bridge.** Le bridge Maison accepte seulement un adaptateur ARCO situé sur `localhost` du MacBook Pro. Cette règle protège l’adresse du contrôleur et conserve la priorité au pupitre physique.

## Résultat attendu

Après cette procédure, DX Hunter affiche le widget **Maison · ARCO**. Il doit présenter un azimut et un état actualisés. Les flèches de direction et la saisie d’azimut restent désactivées ; la bannière indique **Lecture seule**.

## Préparer le MacBook Pro

Le MacBook Pro doit être connecté au réseau local de Maison et avoir Node.js 18 ou supérieur. Vérifier les prérequis avec :

```bash
node --version
security --help >/dev/null
```

Récupérer la branche actuelle de DX Hunter dans un dossier local. Remplacer la commande de clonage par votre méthode habituelle si le dépôt est déjà présent.

```bash
mkdir -p ~/src
cd ~/src
git clone --branch feature/maison-flex-6600m-readonly --single-branch https://github.com/f4ivv-ai/dxhunter.git
cd ~/src/dxhunter/cat-bridge
chmod +x start-maison-arco.sh install-maison-arco-autostart.sh
```

Si le dépôt est privé, s’authentifier d’abord avec GitHub ou cloner depuis GitHub Desktop. Ne copiez jamais de token ARCO dans Git ou dans le fichier de configuration.

## Préparer l’adaptateur ARCO local

Le bridge ne parle pas directement à un contrôleur ARCO. Il a besoin d’un **adaptateur local** déjà installé sur le MacBook Pro, dont l’API fournit :

- `rotator.getState` pour lire azimut et état ;
- `rotator.goTo` pour la phase ultérieure de mouvement explicite ;
- `rotator.stop` pour interrompre un mouvement.

L’adaptateur doit écouter uniquement sur `127.0.0.1`, `localhost` ou `::1`. Son URL doit se terminer par `/api/trpc`. Avant l’installation, tester uniquement la lecture d’état en remplaçant `PORT` :

```bash
curl --fail --silent --show-error \
  'http://127.0.0.1:PORT/api/trpc/rotator.getState?batch=1&input=%7B%7D'
```

Cette requête ne commande aucun mouvement. Elle doit retourner un état contenant notamment `azimuth` et `status`.

## Créer la configuration privée

Lancer une première fois l’installateur. Il crée le fichier de configuration privé puis s’arrête volontairement :

```bash
./install-maison-arco-autostart.sh
```

Ouvrir ensuite le fichier créé :

```bash
nano ~/.config/dxhunter/maison-arco.env
```

Renseigner l’URL locale réelle de l’adaptateur, sans modifier les protections initiales :

```bash
STATION_NAME="Maison"
CONTROLLER_NAME="microHAM ARCO"
ARCO_ADAPTER_URL="http://127.0.0.1:PORT/api/trpc"
OPERATION_MODE="monitor"
ALLOW_ARCO_MOTION="false"
```

Le fichier doit conserver des permissions privées :

```bash
chmod 600 ~/.config/dxhunter/maison-arco.env
```

## Enregistrer le jeton ARCO dans le Trousseau macOS

Le backend DX Hunter doit disposer d’une variable secrète **`ARCO_BRIDGE_TOKEN`**, différente de `CAT_BRIDGE_TOKEN` et longue d’au moins 24 caractères. Cette variable ne doit jamais figurer dans le dépôt ou le fichier `maison-arco.env`.

Après avoir configuré la valeur dans l’environnement du backend DX Hunter, la saisir dans le Trousseau du MacBook Pro :

```bash
read -s 'TOKEN?Jeton ARCO : '; echo
security add-generic-password -U -a "$USER" -s "dxhunter-maison-arco" -w "$TOKEN"
unset TOKEN
```

La commande suivante doit retourner le nombre de caractères du secret sans l’afficher :

```bash
security find-generic-password -a "$USER" -s "dxhunter-maison-arco" -w | wc -c
```

## Installer et démarrer le LaunchAgent

Relancer l’installateur :

```bash
cd ~/src/dxhunter/cat-bridge
./install-maison-arco-autostart.sh
```

Il installe les fichiers dans `~/dxhunter-bridge`, crée `~/Library/LaunchAgents/com.dxhunter.maison-arco.plist`, enregistre le service `com.dxhunter.maison-arco` et le démarre. Vérifier son état :

```bash
launchctl print gui/$(id -u)/com.dxhunter.maison-arco
tail -f ~/dxhunter-bridge/maison-arco.log
```

La journalisation doit confirmer le démarrage en **LECTURE SEULE**, puis la synchronisation de l’état ARCO. Si l’adaptateur local est indisponible, le widget DX Hunter doit l’indiquer hors ligne ; le bridge ne conserve pas une ancienne position comme position active.

## Commandes d’exploitation

| Action                                           | Commande                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Relancer après une modification de configuration | `launchctl kickstart -k gui/$(id -u)/com.dxhunter.maison-arco`                         |
| Arrêter le service                               | `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.dxhunter.maison-arco.plist` |
| Lire les derniers logs                           | `tail -n 100 ~/dxhunter-bridge/maison-arco.log`                                        |
| Réinstaller après mise à jour des scripts        | `cd ~/src/dxhunter/cat-bridge && ./install-maison-arco-autostart.sh`                   |

## Limites de cette phase

Le mode `monitor` est la seule configuration demandée ici. Il ne transmet jamais `goTo`. Le futur mode `operate` devra être activé manuellement après contrôle du sens de rotation, des limites mécaniques, du parcage, des zones interdites, du lien antenne/rotor et de la priorité du pupitre local. Il est indépendant de toute autorisation d’émission du FLEX-6600M.

## Références

[1]: http://www.microham.com/contents/en-us/d50_ARCO.html "microHAM ARCO Smart Antenna Rotator Controller"
[2]: https://support.apple.com/fr-fr/guide/terminal/apdc6e5d6b-0d3f-45e7-8a7c-577bd948f5f2/mac "Apple — Gestion des services launchd avec launchctl"
[3]: https://support.apple.com/fr-fr/guide/keychain-access/welcome/mac "Apple — Guide d’utilisation de Trousseaux d’accès"

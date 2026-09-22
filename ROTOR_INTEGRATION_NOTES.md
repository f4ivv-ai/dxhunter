# Notes d’intégration ARCO dans DX Hunter

## État de l’ancienne intégration

L’ancienne intégration utilisait un proxy serveur vers une application rotor externe. Cette architecture n’est pas retenue pour Maison, car elle fait dépendre un équipement physique d’un service public intermédiaire et ne sépare pas suffisamment la télémétrie du contrôle.

La nouvelle architecture utilise un **bridge ARCO local** sur le MacBook Pro. Le bridge communique seulement avec un adaptateur local sur `localhost`, puis échange avec DX Hunter par une API authentifiée. Le serveur DX Hunter ne connaît ni l’adresse IP du pupitre ARCO, ni ses identifiants, ni une interface VNC.

## Architecture Maison

```text
ARCO ── réseau local / adaptateur local ──> MacBook Pro
                                          │
                                          └── bridge ARCO Maison ── HTTPS authentifié ──> DX Hunter
```

Le bridge remonte les informations suivantes : position mesurée, cible quand disponible, mouvement, statut, défaut, contrôle local et fraîcheur de la télémétrie. Il reçoit une file courte de commandes à usage unique.

## Modes de sûreté

| Mode                                  | Affichage de position |                     Mouvement distant |                        STOP |
| ------------------------------------- | --------------------: | ------------------------------------: | --------------------------: |
| `monitor`                             |                   Oui |                                   Non | Oui si le bridge est vivant |
| `operate` sans autorisation mouvement |                   Oui |                                   Non | Oui si le bridge est vivant |
| `operate` avec autorisation mouvement |                   Oui | Oui, seulement après action explicite |                         Oui |

Le widget ne permet aucun déplacement automatique à partir d’un spot DX, d’un changement de fréquence Flex ou d’une macro de concours. Une priorité locale remontée par l’adaptateur bloque les commandes distantes.

## Points à inventorier avant mouvement

Avant toute commande de mouvement, recueillir le nombre de pupitres ARCO, les rotors liés, les antennes associées, l’azimut/élévation, les limites mécaniques, le parcage, les zones interdites, le sens de rotation validé et les règles d’inhibition PTT associées. Ces données doivent être traitées comme une configuration de station et non comme des constantes du code.

## Documents associés

La procédure d’installation sans mouvement est documentée dans [`docs/MAISON_ARCO_READONLY.md`](docs/MAISON_ARCO_READONLY.md).

# Écoute DX — Spécification V32

## Finalité

**Écoute DX** est un poste d’identification inverse réservé aux administrateurs. L’opérateur part de la fréquence réellement reçue sur son Flex et de la direction réelle de son antenne, puis déclenche volontairement une recherche. La recherche fige la fréquence, le mode, l’azimut et le trajet jusqu’à une nouvelle action de l’opérateur. Elle ne commande jamais le VFO et ne suit pas automatiquement ses mouvements.

## Accès

La route frontend `/ecoute-dx`, son encart d’accès dans l’en-tête et toutes ses procédures serveur sont réservés au rôle `admin`. Une personne reçoit cette fonction lorsqu’elle est promue administrateur dans la gestion des utilisateurs. Le masquage frontend n’est qu’ergonomique ; la sécurité effective repose sur `adminProcedure` côté serveur.

## Déclenchement et état gelé

Au chargement, la page affiche en lecture la fréquence et le mode CAT en cours. Si le rotor est connecté, son azimut est proposé automatiquement. Sinon, l’opérateur saisit un azimut manuel de 0 à 359 degrés. Le bouton **Lancer la recherche** copie ces valeurs dans un état de recherche gelé. Les variations ultérieures du VFO ou du rotor ne modifient pas les résultats tant que le bouton n’est pas actionné de nouveau.

## Tolérances de reconnaissance

| Famille de mode | Tolérance autour de la fréquence gelée |
|---|---:|
| SSB, USB, LSB, PHONE | ±2,5 kHz |
| CW | ±0,5 kHz |
| FT8, FT4, RTTY, DIGI | ±0,1 kHz |

La recherche porte sur les **six dernières heures**. Les résultats sont classés par heure décroissante, puis regroupés sans supprimer les différents spotters. Le système présente les indicatifs candidats et ne choisit jamais arbitrairement la station entendue.

## Contrat serveur

Le routeur `ecouteDx` expose trois procédures administrateur :

| Procédure | Entrée | Sortie |
|---|---|---|
| `search` | fréquence kHz, mode, azimut, SP/LP, locator facultatif | recherche gelée, spots candidats 6 h, récepteurs classés, tolérance appliquée |
| `lookupCall` | indicatif, locator facultatif | données QRZ prioritaires, distance et azimut depuis le QTH |
| `watchMatches` | fréquence kHz, mode, instant de lancement | spots compatibles récents pour surveillance toutes les 15 s |

## Classement des récepteurs

Seuls les récepteurs non locaux situés dans le corridor de **±30°** sont candidats. Le trajet SP utilise l’azimut saisi ; le trajet LP utilise l’azimut opposé `(azimut + 180) mod 360`.

Chaque récepteur reçoit un score sur 100 :

| Critère | Poids | Règle |
|---|---:|---|
| Alignement dans le corridor | 45 | 45 points au centre, décroissance linéaire jusqu’à 0 à ±30° |
| Pertinence géographique | 30 | favorise les distances utiles à la diversité d’écoute, avec un optimum progressif au-delà de 2 000 km |
| Disponibilité technique estimée | 15 | priorité HTTPS puis proxy Kiwi public, sans prétendre garantir un canal libre |
| Préférence utilisateur | 10 | bonus pour un récepteur favori, exclusion des récepteurs supprimés |

Les résultats conservent l’URL originale, l’URL préréglée, le type, la ville, le pays, la distance, l’azimut, l’écart à l’axe et le score détaillé. La disponibilité affichée signifie uniquement que l’URL est exploitable selon les informations connues ; elle ne constitue pas une garantie de canal libre.

## Écoute intégrée et repli

L’ouverture externe dans un nouvel onglet est toujours disponible. L’écoute intégrée est proposée uniquement pour une URL HTTPS compatible avec un cadre intégré. Les récepteurs HTTP ne sont jamais placés dans une iframe HTTPS afin d’éviter le blocage du navigateur. Si le récepteur refuse l’intégration, la page affiche un bouton de repli vers son interface externe préréglée.

## Recherche d’indicatif

QRZ est interrogé en priorité par le serveur à partir des identifiants déjà configurés. La fiche affiche l’indicatif, le prénom et le nom, le pays, la ville, le locator, le continent, les zones CQ/ITU, la distance et les azimuts Short Path/Long Path depuis le locator de l’utilisateur, avec repli sur JN25PG.

## Surveillance du cluster

Après une recherche, la page interroge `watchMatches` toutes les 15 secondes. Un nouveau spot compatible produit une bannière visuelle et une alerte sonore, après déverrouillage audio par l’action explicite **Lancer la recherche**. Les alertes sont dédupliquées par identifiant de spot. La liste conserve tous les candidats et ne remplace pas l’identification par une décision automatique.

## Emplacement dans l’interface

Un encart très distinct **Écoute DX** est placé en haut à gauche de la page Cluster, immédiatement après le titre DX Daruma et avant le rotor et l’indicateur de fréquence. Il n’apparaît que pour les administrateurs. Le menu mobile contient le même accès.

## Réutilisation de l’existant

La fonction réutilise `useFlexCat`, `useRotor`, `qrzLookup`, `buildTuneUrl`, les préférences WebSDR et la source de spots agrégée existante. Elle remplace les automatismes de SelfMonitor par un lancement strictement manuel afin de ne jamais rafraîchir la recherche à chaque mouvement du VFO ou du rotor.

## Constats vérifiés sur les sources externes

Spothole confirme officiellement qu’il agrège les clusters Telnet, le Reverse Beacon Network et d’autres sources dans un format JSON commun. Son instance peut désactiver certaines sources ; la recherche Écoute DX doit donc présenter ce qu’elle reçoit sans promettre une exhaustivité absolue. La page officielle indique aussi que Spothole peut effectuer des recherches d’indicatifs via QRZ et HamQTH, mais DX Daruma conserve son client QRZ direct existant pour maîtriser le contrat et la sécurité.

La documentation officielle KiwiSDR confirme que l’écoute se fait dans le navigateur, que plusieurs auditeurs indépendants peuvent être servis selon la configuration de chaque appareil, et que le répertoire public est `rx.kiwisdr.com`. La base locale contient cependant une majorité d’URL HTTP ; l’intégration dans la page HTTPS restera donc conditionnelle et l’ouverture externe préréglée sera le repli fiable.

### Références

[1]: https://spothole.app/about "About Spothole"
[2]: http://kiwisdr.com/info/ "KiwiSDR Operating Information"
[3]: http://kiwisdr.com/ks/using_Kiwi.html "Introduction to using the KiwiSDR"

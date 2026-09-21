# DX Hunter — Guide d'utilisation

**DX Hunter** est un tableau de bord temps réel conçu pour repérer un maximum de **DX** (stations lointaines) sur les bandes HF, avec une **priorité au trafic SSB** sur les bandes **10, 15, 20, 40, 80 et 160 m**. Le CW reste affiché en complément, sans être prioritaire.

L'application agrège en continu les annonces (« spots ») publiées sur les **DX clusters** mondiaux via l'API publique **Spothole** (clusters DX + Reverse Beacon Network). Les données sont rafraîchies automatiquement toutes les 12 secondes.

## Vue d'ensemble de l'écran

L'interface est organisée comme une console d'opérateur, en trois zones principales.

| Zone | Emplacement | Rôle |
| --- | --- | --- |
| **Bandeau supérieur** | En haut | Horloge UTC, compteurs (Cibles / SSB / Total / Rares), état de connexion, actualisation, et **bandeau de propagation solaire** |
| **Panneau de filtres** | À gauche | Sélection des bandes, modes, continents, recherche, alerte sonore, et **liste « à chasser »** |
| **Flux DX en direct** | Au centre | Tableau des spots les plus récents, avec priorisation cibles puis SSB |
| **Carte & statistiques** | À droite | Carte mondiale, activité par bande et **ouverture par continent** |

## Le flux de spots

Chaque ligne représente une station entendue et annoncée par un autre opérateur. Les colonnes affichent : l'**âge** du spot (fraîcheur), la **bande**, la **fréquence en kHz**, le **mode** (USB, LSB, SSB, CW…), l'**indicatif DX** entendu, le **pays** (avec drapeau), ainsi que le **spotter** et son éventuel commentaire.

Les spots **SSB** sont mis en avant visuellement (accent vert phosphore). Lorsque le bouton **« SSB d'abord »** est activé (par défaut), toutes les annonces SSB remontent en tête de liste, puis le reste est trié du plus récent au plus ancien. Désactivez-le pour un tri purement chronologique.

## Les filtres

Le panneau de gauche permet de cibler précisément ce que vous chassez :

- **Bandes** : activez/désactivez chacune des six bandes suivies (160, 80, 40, 20, 15, 10 m). Chaque bande a sa couleur, reprise sur la carte et les statistiques.
- **Modes** : **SSB (priorité)** et **CW** sont activés par défaut ; **Digital** est désactivé. Pour ne traquer que la phonie, désactivez CW.
- **Continent du DX** : limitez l'affichage à un ou plusieurs continents de la station entendue.
- **Recherche** : saisissez un indicatif, un préfixe ou un pays (ex. `9M0`, `Spratly`, `FT4`) pour filtrer instantanément.
- **DX rares uniquement** : ne montre que les entités DXCC réputées rares/recherchées (détection par préfixe).
- **Réinitialiser les filtres** : revient à la configuration de départ.

## Cibles « à chasser »

Le panneau **« À CHASSER »** (sous les filtres) vous permet de définir vos entités prioritaires. Saisissez un **préfixe/indicatif** (ex. `P5`, `3Y`, `FT5GA`) ou un **fragment de nom de pays** (ex. `Spratly`) puis validez avec Entrée ou le bouton `+`. Des suggestions de DX très recherchés sont proposées en un clic. Vos cibles sont **mémorisées** dans le navigateur (elles persistent entre les sessions).

Dès qu'un spot correspond à une cible, il est **surligné en ambre** avec une icône de réticule, **remonté tout en haut** du flux (avant même le SSB), et un compteur **« Cibles »** apparaît dans le bandeau. Si l'alerte sonore est active, une **notification prioritaire** (son + message persistant indiquant la fréquence) se déclenche.

## Propagation solaire

Le **bandeau de propagation** (sous le titre) affiche les indices clés en temps réel : **SFI** (flux solaire), **A** et **K** (activité géomagnétique — plus c'est bas, mieux c'est), **X-Ray**, et le nombre de **taches solaires (SN)**. Une synthèse **« HF jour »** indique l'état estimé des groupes de bandes (ex. `12-10m Good`), coloré du rouge (mauvais) au vert (bon), pour juger d'un coup d'œil si les bandes hautes sont exploitables.

## Alertes sonores

Activez le commutateur **« Alerte sonore »** pour être prévenu sans regarder l'écran. Un **bip** retentit à l'arrivée d'un nouveau spot SSB pertinent, et une **séquence sonore distincte** accompagnée d'un message visuel signale un **DX rare**. La première activation nécessite un clic sur la page (contrainte des navigateurs pour autoriser le son).

## La carte et les statistiques

La **carte mondiale** positionne chaque station entendue, avec un point coloré selon sa bande. Survolez une ligne du tableau pour mettre en évidence la station correspondante sur la carte, et inversement.

Le bloc **« Activité par bande »** indique, pour chaque bande, le nombre de spots SSB (barre pleine) rapporté au total (barre claire), pour repérer d'un coup d'œil quelles bandes sont ouvertes.

Le bloc **« Ouverture par continent »** est une matrice **bande × continent** (EU, AS, NA, SA, AF, OC) : chaque case se colore selon le nombre de stations entendues sur cette bande vers ce continent. Cela permet de visualiser instantanément vers quelles régions du monde chaque bande est ouverte.

## Conseils d'utilisation

L'outil est **informatif** : il indique où une station a été entendue récemment, mais la propagation évolue vite. Vérifiez toujours en écoutant réellement la fréquence avant d'appeler. Pour chasser un pays précis, combinez le filtre **continent** avec la **recherche par préfixe** et activez l'**alerte sonore** afin de réagir dès qu'un spot correspondant apparaît.

## Source des données

Les spots proviennent de l'API publique **Spothole** (`spothole.app`), qui consolide les principaux DX clusters et le Reverse Beacon Network. Aucun compte ni indicatif n'est requis pour la consultation. La requête transite par le serveur de l'application pour garantir un fonctionnement fiable dans le navigateur.

---

# Module Pilotage TM0HQ — 40 m SSB (IARU HF Championship)

En complément du radar général, DX Hunter intègre un **poste de pilotage** dédié à l'opération **TM0HQ** sur **40 m SSB** depuis le QTH **JN25PG**, pour le **IARU HF World Championship (11-12 juillet 2026)**. On y accède par le bouton **« Pilotage TM0HQ 40m »** du bandeau, ou via l'onglet **Pilotage 40m** en haut de page.

La page s'organise en onglets : **Recommandations live**, **Briefing & rôles**, **Multiplicateurs**, **Plan 24 h**, **WebSDR** et **Calibration**.

## Recommandations live — « Où viser maintenant »

Pour l'instant présent, le moteur de propagation 40 m calcule, zone par zone, un **score d'ouverture (0-100)** depuis JN25PG. Chaque zone affiche le **cap à prendre** (azimut), en **short path (SP)** ou **long path (LP)** selon le plus favorable, la **distance**, et un verdict d'ouverture. Les zones sont triées par potentiel, en tenant compte de la propagation, des **multiplicateurs manquants** et de l'**activité réelle**. Le bouton **« Écoute »** ouvre un WebSDR orienté vers la zone.

Le score combine l'état **jour / nuit / grayline** aux deux extrémités du trajet, la **distance**, et les **conditions solaires temps réel** : un **Kp élevé** pénalise fortement les chemins passant par les hautes latitudes (routes polaires/nord), un **SFI élevé** favorise les liaisons très longues, et un **black-out radio (R1-R5)** dégrade les trajets de jour.

## Plan 24 h et rôles

L'onglet **Plan 24 h** propose une **timeline horaire** des directions à privilégier sur les 24 heures du concours. L'onglet **Briefing & rôles** aide à répartir l'équipe (runner / multiplicateurs / in-band / écouteur WebSDR), et **Multiplicateurs** suit les zones ITU et sociétés HQ déjà contactées ou encore manquantes.

## Journal de calibration — entraînement J-12 → J-0

L'onglet **Calibration** est l'outil d'**entraînement du modèle** dans les jours qui précèdent le concours. Son principe : à intervalle régulier, l'application prend un **instantané** comparant, pour chaque zone, le **score d'ouverture prédit** par le modèle au **trafic 40 m réellement observé** (nombre de spots vers cette zone, converti en score). L'écart entre les deux mesure la justesse du modèle.

Trois indicateurs résument l'état :

| Indicateur | Signification |
| --- | --- |
| **Fiabilité (14 j)** | Justesse globale du modèle sur les 14 derniers jours (100 % = prédictions parfaites) |
| **Écart moyen** | Erreur absolue moyenne en points, toutes zones confondues |
| **Biais** | Tendance du modèle : **positif** = il *sur-estime* les ouvertures (trop optimiste) ; **négatif** = il *sous-estime* (des ouvertures réelles passent inaperçues) |

Le tableau **« Progression jour par jour »** montre l'évolution de la fiabilité de J-12 jusqu'au jour J ; cliquez sur une journée pour afficher le **détail par zone** (prédit, réel, nombre de spots, écart). Le bouton **« Capturer maintenant »** déclenche un instantané immédiat ; une **capture automatique quotidienne** est par ailleurs prévue (voir ci-dessous).

**Apprentissage** : à partir de cet historique, le modèle apprend le **biais propre à chaque zone** (pondéré par la fraîcheur des observations) et **corrige** ses scores en conséquence — d'autant plus fortement que les observations sont nombreuses. L'objectif est de capturer régulièrement, idéalement **aux heures du concours (12-12 UTC)**, pour affiner l'œil du pilote d'ici le jour J.

> Note : la **capture automatique quotidienne** s'appuie sur une tâche planifiée côté serveur. Elle ne devient active **qu'une fois le site publié** (déployé) ; en prévisualisation, utilisez la capture manuelle.

## Affichage mobile

L'ensemble de l'application (radar et pilotage) est **responsive** : sur ordinateur (PC/Mac), l'affichage est dense en colonnes ; sur smartphone, les panneaux s'empilent verticalement, le flux de spots replie ses colonnes secondaires (mode, pays, spotter) sous l'indicatif pour rester lisible, et la barre d'onglets du pilotage défile horizontalement.

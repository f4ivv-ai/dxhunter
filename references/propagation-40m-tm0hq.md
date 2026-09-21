# Base de connaissances — Propagation 40 m SSB pour TM0HQ (JN25PG)

Document de référence interne servant à alimenter le moteur de propagation et le module de pilotage de l'application. QTH de référence : **JN25PG ≈ 45,27° N / 5,29° E** (sud-est de la France). Contexte : **IARU HF World Championship**, du **samedi 11 juillet 2026 12:00 UTC** au **dimanche 12 juillet 2026 11:59 UTC** (24 h). TM0HQ = station HQ française, envoie **report + « REF »**. Zone ITU 27, zone CQ 14. Les autres stations envoient **report + zone ITU** ; les multiplicateurs sont les **zones ITU** et les **sociétés HQ**.

## 1. Pourquoi 40 m est la « machine à DX » des bandes basses

Le 40 m (7,0–7,2 MHz en région 1, SSB surtout 7,06–7,20) est un excellent compromis entre portée et fiabilité. Son comportement est gouverné par le cycle diurne de l'ionosphère :

- **De jour**, la couche **D** (absorbante) est active et atténue fortement les signaux : la portée se réduit à du régional/semi-DX (NVIS et sauts courts, typiquement < 1500–2000 km). C'est la période « run européen » par excellence pendant un contest.
- **De nuit**, la couche D disparaît, les couches F fusionnent et montent : l'absorption chute, le 40 m s'ouvre au **DX mondial**. Les signaux lointains arrivent avec des angles de départ bas.
- **Aux transitions (grayline / terminateur)**, on obtient le meilleur des deux mondes : MUF encore élevée côté coucher, absorption D déjà effondrée → **pics de propagation** vers les régions situées le long de la ligne jour/nuit. Ces fenêtres durent de quelques minutes à ~1 h.

Conséquence pour le contest en plein été (11–12 juillet) : nuits **courtes** aux latitudes européennes. La fenêtre DX nocturne sur 40 m est donc **resserrée** (~21:00–04:00 UTC environ), ce qui rend le **timing critique**. Le jour, 40 m = run EU massif ; la nuit, 40 m = chasse aux multiplicateurs lointains (zones ITU et HQ d'Amérique, d'Asie, d'Océanie).

## 2. Mécanismes à connaître

| Mécanisme | Description | Exploitation 40 m depuis JN25 |
| --- | --- | --- |
| **Absorption D (jour)** | Couche D ionisée par le Soleil, absorbe les bandes basses le jour | Portée courte de jour → run EU ; inutile de pointer DX lointain en plein midi |
| **Saut F (nuit)** | Couches F recombinées, réfraction haute altitude, faible absorption | Ouvertures DX mondiales la nuit, sauts longs multiples |
| **Grayline / terminateur** | Bande crépusculaire mobile : MUF haute + D effondrée | Pics au coucher (vers l'est/sud-est) et au lever (vers l'ouest) |
| **Short path (SP)** | Trajet géodésique le plus court | Cap direct, le plus courant |
| **Long path (LP)** | Trajet par l'autre hémisphère (azimut SP + 180°) | Souvent fort vers Asie/Pacifique au coucher ; tester quand SP faible |
| **Chordal hops / ducting** | Sauts enchaînés sans réflexion sol, le long du terminateur | Explique les signaux LP étonnamment forts en grayline |
| **TEP / transéquatorial** | Renforcement à travers l'équateur magnétique | Aide vers Afrique/Amérique du Sud en début de nuit |

**Indices de propagation utiles** : **SFI** (flux solaire — plus haut = MUF plus haute), **A** et **K** (activité géomagnétique — **bas = bon**, surtout pour les trajets polaires/nord). Un **K ≥ 4** dégrade fortement les chemins vers le nord (Scandinavie, UA9, JA par le pôle) : privilégier alors les caps sud.

## 3. Géométrie depuis JN25PG — azimuts et distances

Azimuts great-circle calculés depuis JN25PG. LP = SP + 180°.

| Zone (exemples d'indicatifs) | Cap SP | Cap LP | Distance SP (km) | Intérêt contest |
| --- | --- | --- | --- | --- |
| Europe de l'Est (UA, UR, SP) | 64° | 244° | 1 955 | Run + zones ITU 28/29 |
| Scandinavie (OH, SM, LA) | 31° | 211° | 2 104 | Zones nord, sensibles au K |
| Moyen-Orient (A4, 9K, 4X) | 101° | 281° | 4 100 | Zones ITU 39/21 |
| Russie d'Asie (UA9/0) | 49° | 229° | 5 342 | Zones ITU 30/31/32 |
| USA Est (W1–W4, VE) | 296° | 116° | 6 202 | Gros réservoir de QSO + zones ITU 8/9 |
| Inde (VU) | 80° | 260° | 6 434 | Zone ITU 41 |
| Caraïbes (PJ, FY, FG) | 270° | 90° | 7 146 | Zones ITU 11 |
| Afrique du Sud (ZS) | 159° | 339° | 8 273 | Zone ITU 57, TEP |
| Brésil (PY) | 227° | 47° | 9 273 | Zone ITU 15, TEP |
| USA Ouest (W6/W7) | 316° | 136° | 9 527 | Zones ITU 6/7, difficile |
| Japon (JA) | 35° | 215° | 9 914 | Zone ITU 45, souvent par LP |
| Asie SE (9M, HS, YB) | 83° | 263° | 10 263 | Zones ITU 49/54, LP au coucher |
| Australie Est (VK2) | 78° | 258° | 16 862 | Zone ITU 59, LP |
| Nouvelle-Zélande (ZL) | 66° | 246° | 19 059 | Zone ITU 60, antipode, LP |

Lecture pratique : pour viser une station, on règle l'antenne directive (ou on choisit le lobe) sur le **cap SP** ; si le signal est faible ou absent alors que la zone devrait être ouverte en grayline, on **teste le LP** (cap opposé).

## 4. Plan horaire prévisionnel 40 m (été, depuis JN25, en UTC)

En juillet, à JN25, le **coucher de soleil local ≈ 19:15 UTC** (21:15 locale) et le **lever ≈ 04:10 UTC** (06:10 locale). Le contest démarre à 12:00 UTC samedi (plein jour). Plan indicatif (à ajuster avec le live et le K du moment) :

| Tranche UTC | État 40 m | Direction prioritaire | Action conseillée |
| --- | --- | --- | --- |
| 12:00–17:00 | Jour, absorption D | EU proche (run) | **Runner** : run EU continu, gros débit. Multi : chasser HQ EU + zones ITU proches |
| 17:00–19:00 | Pré-coucher | EU + premières ouvertures Est | Surveiller l'Est (UA9, Moyen-Orient) ; préparer la grayline |
| 19:00–20:30 | **Grayline coucher** | Est / Sud-Est, puis Afrique | **Fenêtre or** : tenter Asie (LP 263°), Afrique (159°), Moyen-Orient. Écouteur WebSDR pointe l'est |
| 20:30–23:00 | Nuit montante | Amérique (vers l'ouest) s'ouvre | Basculer le run vers l'Atlantique ; chasser zones ITU US (8/9) et Caraïbes |
| 23:00–02:30 | **Cœur de nuit** | Amériques + DX lointain | Run US/SA ; multi chasse W6/W7 (316°), PY (227°), zones rares |
| 02:30–04:00 | **Grayline lever** | Ouest restant + Pacifique LP | Dernière fenêtre US Ouest ; tenter JA/VK/ZL en LP avant la fermeture |
| 04:00–06:00 | Lever, D réapparaît | Retour EU + Asie courte | Le DX lointain se referme ; revenir au run EU pour le débit |
| 06:00–11:59 | Jour | EU proche (run) | Run EU pour maximiser le volume jusqu'à la fin |

Règle d'or de timing : les **multiplicateurs lointains** (zones ITU et HQ d'autres continents) se chassent **la nuit et en grayline** ; le **volume de QSO** se fait **le jour sur l'Europe**. Avec des nuits courtes, ne pas gaspiller la fenêtre nocturne en run EU : confier le DX au poste multi/in-band pendant que le runner garde une fréquence.

## 5. Répartition des rôles de l'équipe TM0HQ sur 40 m

- **Runner** : tient une fréquence d'appel (CQ TEST), maximise le débit. De jour → run EU ; la nuit → peut tourner le run vers l'Amérique. Doit garder sa fréquence coûte que coûte.
- **Multiplicateur (mult)** : parcourt la bande (S&P) pour décrocher les **nouvelles zones ITU** et **sociétés HQ** non encore travaillées. Suit les recommandations d'azimut/heure pour pointer la bonne direction au bon moment.
- **In-band** : second poste sur 40 m (configuration multi-deux/multi-multi selon catégorie), travaille les multiplicateurs repérés pendant que le runner enchaîne, ou tient un second run. Coordination anti-interférence indispensable (filtres, séparation de fréquence).
- **Écouteur WebSDR** : oreille déportée. Sert à (1) confirmer une ouverture avant de tenter (écoute un SDR situé dans la zone cible ou sur le trajet), (2) repérer des stations DX/mult avant qu'elles ne soient spottées, (3) juger la qualité réelle de la propagation (force des signaux, QSB). Il guide le mult et l'in-band vers les fenêtres réellement actives.

## 6. WebSDR utiles pour 40 m depuis l'Europe

- **WebSDR Twente (PA3FWM, Pays-Bas)** : `http://websdr.ewi.utwente.nl:8901/` — référence européenne, excellent pour juger l'état EU et l'ouverture vers l'est/ouest.
- **WebSDR.org** : annuaire mondial `http://websdr.org` — choisir un récepteur **dans la zone cible** (ex. un SDR au Japon pour vérifier l'ouverture JA, un SDR aux USA pour l'Atlantique).
- **KiwiSDR map** : `http://kiwisdr.com/public/` — des centaines de récepteurs géolocalisés ; idéal pour écouter « depuis » la zone visée et confirmer la réciprocité du trajet.

Méthode : avant d'engager le mult sur un cap, l'écouteur ouvre un SDR situé **dans la région cible** et écoute le segment 40 m SSB ; s'il entend des stations européennes (ou TM0HQ) y arriver fort, le trajet est ouvert dans les deux sens → feu vert.

## 7. Limites et bon sens

Tout ceci relève de **probabilités**, pas de certitudes. La grayline « augmente la probabilité » d'ouverture, elle ne la garantit pas. Les prévisions horaires sont des points de départ : la **vérification à l'écoute** (poste + WebSDR) prime toujours. Un orage géomagnétique (K élevé) peut fermer les chemins nord et tout décaler. L'application doit donc combiner ce modèle théorique avec les **spots 40 m en direct** et l'**état solaire temps réel** pour proposer des recommandations vivantes.

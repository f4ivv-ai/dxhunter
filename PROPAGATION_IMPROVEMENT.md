# Amélioration des Prévisions de Propagation — Analyse et Plan

## Mise en œuvre V32 — 6 septembre 2026

La collecte est désormais exécutée quatre fois par heure, aux minutes 05, 20, 35 et 50 UTC. Le schéma conserve le quart d’heure dans `minuteUtc`, de sorte que les captures successives ne s’écrasent plus dans un unique enregistrement horaire. Une capture réelle a validé la création de **36 lignes** pour les six bandes et les six continents au créneau 08:45 UTC.

Le collecteur persiste maintenant les combinaisons fermées avec `spotCount = 0`. Cette correction est essentielle : l’ancien historique ne conservait que les ouvertures et ne pouvait donc pas apprendre correctement la fréquence des fermetures. La fenêtre d’observation est passée à vingt minutes afin de couvrir chaque quart d’heure malgré un léger retard de déclenchement.

Le modèle corrige également l’échelle SNR, abaisse la confiance des anciennes données horaires incomplètes et fusionne les scores NOAA avec l’historique FT8 selon la couverture réellement disponible. La page Prévisions affiche maintenant la source **NOAA + FT8** et la confiance FT8 séparément du score de propagation.

> L’objectif de 65 à 70 % est une cible de validation, pas une précision déjà démontrée. Une mesure sérieuse nécessite plusieurs jours de nouveaux créneaux contenant à la fois les ouvertures et les fermetures. Le système va désormais constituer cette base à rythme constant.

## Diagnostic du système actuel

### Problème principal : le forecast 7j est 100% NOAA, 0% FT8

Le module `forecast.ts` calcule les prévisions uniquement à partir de :
1. NOAA 27-day outlook (SFI, A-index, Kp)
2. NOAA Kp forecast 3h
3. NOAA 3-day forecast text (probabilités éruptions/blackouts)

Il n'utilise **aucune** donnée FT8 observée. Le modèle `predictScore()` dans `calibration.ts`
est un modèle théorique basé sur :
- Position solaire (jour/nuit/grayline) au QTH et à la cible
- Distance du trajet
- Latitude max du trajet (sensibilité Kp)
- SFI pour les bandes hautes

### Problème secondaire : les prédictions `ft8Directions` sont trop simplistes

La prédiction dans `spots.ts` (ft8Directions) fait :
- Historique des 30 derniers jours à la même heure UTC
- Probabilité = nombre de jours avec spotCount > 0 / 30

C'est une probabilité brute sans pondération par :
- Conditions solaires similaires (SFI, Kp)
- Tendance récente (les 7 derniers jours pèsent autant que les 30)
- SNR moyen (un spot à -7 dB n'est pas la même ouverture qu'un spot à +15 dB)

### Données disponibles (5487 rows, depuis 2026-07-24)

Table `propagation_ft8_hourly` : snapDate, hourUtc, band, continent, spotCount, avgSnr, maxSnr, sfi, kp

## Plan d'amélioration

### 1. Capture plus fréquente (toutes les 15 min au lieu de 1h)

Le PSKReporter MQTT donne des spots en temps réel. La fenêtre de 5 min en mémoire
est trop courte pour capturer les tendances. On va :
- Capturer toutes les 15 minutes (au lieu de 1h)
- Garder la granularité horaire en base mais avec 4 échantillons par heure (moyenne)

### 2. Modèle de prédiction amélioré

Remplacer la probabilité brute par un score pondéré :
- **Pondération temporelle** : les jours récents (7j) pèsent 3x plus que les anciens
- **Pondération par conditions solaires** : les jours avec SFI/Kp similaires pèsent plus
- **Score SNR** : intégrer le SNR moyen pour qualifier la force de l'ouverture
- **Tendance** : détecter si la propagation est en amélioration ou dégradation

### 3. Fusion NOAA + FT8 dans le forecast 7j

Le forecast 7j doit croiser :
- Le score théorique NOAA (ce qu'on attend)
- L'historique FT8 réel (ce qu'on a observé dans des conditions similaires)

Formule : `finalScore = 0.4 * noaaScore + 0.6 * ft8ObservedScore`

Le ft8ObservedScore est calculé à partir des jours historiques avec des conditions
solaires proches (SFI ±15, Kp ±1).

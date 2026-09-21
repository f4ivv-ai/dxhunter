# DX Hunter — TODO

## V35 — Sécurisation du dépôt public et des commandes radio
- [x] Remettre temporairement le dépôt GitHub en privé
- [x] Générer et enregistrer `CAT_BRIDGE_TOKEN` et `CONTEST_TOKEN` hors du code
- [x] Ajouter une comparaison à temps constant et révoquer l’ancien jeton public
- [x] Réserver `cat.command` et `antenna.command` aux administrateurs
- [x] Retirer le jeton historique de tous les bridges, scripts et guides
- [x] Mettre à jour le bridge Mac avec stockage du jeton dans le Trousseau
- [x] Masquer les coordonnées rotor publiées
- [x] Valider TypeScript, build, 350 tests et le nouveau jeton sur l’endpoint tRPC réel
- [x] Assainir l’historique GitHub, publier le checkpoint V35 et remettre le dépôt en public

## V34 — Mon Kiwi direct depuis chaque spot
- [x] Ajouter « Mon Kiwi F4IVV » après « Carte KiwiSDR » sur la ligne QSY / Split / QRZ
- [x] Accorder automatiquement le Kiwi sur la fréquence et le mode du spot
- [x] Mettre cet accès direct en évidence avant la sélection intelligente WebSDR
- [x] Valider TypeScript, build et tests complets (331 tests)

## V33 — KiwiSDR F4IVV Marcilloles + propagation locale prioritaire
- [x] Ajouter `23147.proxy.kiwisdr.com:8073` à la base KiwiSDR avec Marcilloles/JN25oi
- [x] Afficher le Kiwi F4IVV en priorité dans Écoute DX et le Self-Monitor via HTTP
- [x] Ajouter un contrôle d'état `/status` avec détection accès privé, nom et GPS incohérents
- [x] Souscrire au filtre TX fourni `pskr/filter/v2/+/+/F4IVV/+/+/+/+/+`
- [x] Ajouter le filtre RX miroir `pskr/filter/v2/+/+/+/F4IVV/+/+/+/+`
- [x] Dédupliquer les messages reçus par plusieurs abonnements MQTT
- [x] Prioriser les captures FT8 SNR >= -8 dans l'ordre F4IVV → JN25 → ITU 27 → monde
- [x] Conserver 30 minutes de spots en mémoire pour couvrir les captures par quart d'heure
- [x] Tracer `receiverSource` et `receiverCall` dans chaque snapshot FT8
- [x] Réserver l'écriture des snapshots au Heartbeat authentifié (suppression de la mutation publique)
- [x] Corriger l'adresse utilisateur en `http://23147.proxy.kiwisdr.com:8073/` et supprimer le blocage HTTPS
- [x] Rendre « Écouter mon KiwiSDR » toujours visible et ouvrir l'adresse HTTP exactement comme les autres Kiwi
- [x] Valider par probe que le décodeur ne publie pas encore vers PSKReporter sous l'indicatif RX `F4IVV` (0 rapport reçu ; repli actif)
- [x] Identifier les réglages externes restants : nom public Tauranga, position GPS Paris et accès privé

## Données & backend
- [x] Source de données temps réel identifiée (API Spothole)
- [x] Proxy backend tRPC `spots.list` (évite CORS/CSP)
- [x] Endpoint `spots.solar` (conditions de propagation)
- [x] Polling temps réel toutes les 12 s côté client

## Interface
- [x] Thème "Station Tactique" sombre + logo
- [x] Bandeau rig (horloge UTC, compteurs SSB/Total/Rares, état connexion)
- [x] Tableau des spots en direct (âge, bande, fréquence, mode, DX, pays, spotter)
- [x] Filtres bandes 160/80/40/20/15/10 m
- [x] Filtres modes (SSB prioritaire, CW, Digital)
- [x] Filtres continent du DX + recherche indicatif/pays
- [x] Carte mondiale radar des spots
- [x] Statistiques d'activité par bande

## Priorisation & alertes
- [x] Bouton "SSB d'abord" (tri prioritaire SSB)
- [x] Mise en évidence visuelle SSB (vert phosphore)
- [x] Détection entités DXCC rares (préfixes)
- [x] Filtre "DX rares uniquement"
- [x] Alertes sonores (bip SSB / séquence rare) via Web Audio
- [x] Toast d'alerte pour DX rares

## Finalisation
- [x] Retrait des diagnostics temporaires
- [x] Tests vitest du proxy spots (4/4 OK)
- [x] Vérification finale + checkpoint
- [x] Guide d'utilisation

## V2 — Fonctions avancées
- [x] Endpoint backend propagation solaire (SFI, A, K, état bandes)
- [x] Bandeau de propagation solaire dans l'UI
- [x] Liste de cibles personnalisée (entités à chasser) — saisie + persistance localStorage
- [x] Surlignage + alerte prioritaire pour les cibles
- [x] Indicateur d'ouverture de bande par continent
- [x] Historique/mémoire des spots récents (fenêtre 2h, détection des nouveaux)
- [x] Tests vitest (16/16 OK : logique cibles/modes/rare + endpoints spots.list & spots.solar)
- [x] Checkpoint V2 + mise à jour du guide

## V3 — Poste de pilotage 40 m SSB pour TM0HQ (QTH JN25PG)
- [x] Base de connaissances propagation 40 m (mécanismes, grayline, SP/LP, cycle diurne, fenêtres)
- [x] Moteur géo : azimut + distance short path / long path depuis JN25PG vers chaque zone
- [x] Grayline temps réel (terminateur jour/nuit) et heures de lever/coucher
- [x] Modèle d'ouverture 40 m par heure UTC et par direction depuis JN25
- [x] Recommandations horaires d'azimut ("tente maintenant tel cap")
- [x] Plan prévisionnel 24 h pour le contest (timeline par direction)
- [x] Répartition des rôles : runner / multi / in-band / écouteur WebSDR
- [x] Intégration WebSDR (liens d'écoute par bande/zone)
- [x] Croisement spots 40 m live avec la prédiction d'ouverture
- [x] Tests propagation 40 m (9/9) + guide — checkpoint consolidé dans V4 (d5b433be)

## V3 — Précisions exigences (IARU, multi, WebSDR, pilotage)
- [x] Moteur géo/propagation 40 m (azimut SP/LP, grayline, modèle ouverture)
- [x] Suivi des multiplicateurs : zones ITU (1-90 pertinentes) + sociétés HQ — coché/manquant
- [x] Recommandations d'azimut/zone "maintenant" basées sur le moteur
- [x] Répartition runner / multi / in-band / écouteur WebSDR
- [x] Grille WebSDR multi-continents (Est/Ouest/Nord/Sud + îles), beaucoup de SDR
- [x] Croisement spots 40 m live + prédiction d'ouverture
- [x] Briefings préparation J-24h / J-12h / J-6h / J-1h
- [x] Pilotage horaire sur toute la durée du concours (timeline 24 h)
- [x] Fenêtre glissante "6 h avant" + recommandations temps réel
- [x] Tests propagation 40 m + guide — checkpoint consolidé dans V4 (d5b433be)

## V3 — Réalisé (récapitulatif)
- [x] Moteur géo/propagation 40 m (azimut SP/LP, grayline, modèle ouverture) + tests 9/9
- [x] Suivi des multiplicateurs : zones ITU + sociétés HQ (coché/spotté/manquant)
- [x] Recommandations d'azimut/zone "maintenant" basées sur le moteur
- [x] Répartition runner / multi / in-band / écouteur WebSDR (briefing)
- [x] Grille WebSDR multi-continents (16 SDR : Est/Ouest/Nord/Sud + îles)
- [x] Briefings préparation J-24h / J-12h / J-6h / J-1h
- [x] Pilotage horaire 24 h (timeline) + fenêtre glissante "6 h avant"
- [x] Page Pilotage avec navigation Radar/Pilotage

## V4 — Expertise solaire, entraînement & mobile
- [x] Recherche approfondie météo solaire : SFI, indices K/A, éruptions (C/M/X), impact 40 m
- [x] Enrichir la base de connaissances solaire (references/meteo-solaire-40m.md)
- [x] Endpoint backend NOAA temps réel (Kp 1m, SFI, flares X-ray, 27-day)
- [x] Moteur : intégrer effets K/A/flares sur chemins (nord/polaire/grayline)
- [x] Guidage pédagogique décisionnel (ex. K=5 → éviter nord) via SolarVerdict
- [x] Bandeau solaire enrichi : flux NOAA temps réel (SFI, K, A, flares, black-out)
- [x] Journal de calibration : capture quotidienne spots réels vs prédiction
- [x] Mesure des écarts + ajustement du modèle jour par jour
- [x] Plan d'entraînement J-12 → J-0 (snapshot quotidien automatique)
- [x] Responsive complet page Radar (mobile tactile)
- [x] Responsive complet page Pilotage (mobile tactile)
- [x] Tests vitest (effets solaires + calibration)
- [x] Checkpoint V4 + guide solaire + plan d'entraînement

## V4 Phase 3 — Journal de calibration (détail)
- [x] Table `calibration_snapshots` (date, hourUtc, zoneId, predictedScore, actualSpots, kp, sfi, aIndex, error, note)
- [x] `pnpm db:push` (migration)
- [x] Helpers db.ts : saveCalibrationSnapshots (upsert), listCalibrationSnapshots, calibrationByDate, hasCalibrationSlot
- [x] Procédures tRPC : spots.runCalibration, spots.listCalibration, spots.calibrationDay
- [x] Handler Heartbeat `/api/scheduled/calibration` (capture quotidienne auto)
- [x] Composant CalibrationJournal : tableau J-12 → J-0, écart prédit/réel, score de fiabilité
- [x] Onglet "Calibration" dans la page Pilotage
- [x] Bouton "Capturer maintenant" (déclenche un snapshot manuel)
- [x] Tests vitest logique de calibration (calcul d'écart, agrégation) — 15 tests OK
- [x] Ajustement du modèle par zone (apprentissage du biais) + procédure calibratedScores
- [x] Enregistrer la planification Heartbeat quotidienne (cron 12:00 UTC, task_uid J2jwF3Sp8gvrHpiDE8HYns) — actif

## Correctif urgent — accès public (site bloqué par mur de connexion)
- [x] Identifier la cause : visibilité « privée » de l'hébergement (302 → app-auth), pas le code
- [x] Audit complet des appels tRPC de l'UI : pages publiques n'utilisent que des publicProcedure (spots.*) ; auth.me/useAuth non montés sur Radar/Pilotage
- [x] Accès débloqué (passage en public côté réglages) — vérifié HTTP 200 direct sur / , /pilot et /api/trpc (plus de 302 app-auth)

## Autonomie 24/7
- [x] Capture calibration automatique quotidienne (cron Heartbeat 12:00 UTC)
- [x] Handler de production vérifié (403 sur appel non-cron)
- [x] Checkpoint final

## V5 — Prévision propagation 40 m à 7 jours (croisement NOAA + SWL)
- [x] Explorer et valider les sources NOAA (27-day outlook, Kp forecast 3j, probabilités éruptions)
- [x] Backend : fetch prévisions NOAA + croisement avec données existantes + calcul score propagation 40m par jour/zone
- [x] Procédure tRPC : spots.forecast7d (retourne 7 jours de prévision par zone)
- [x] Page dédiée "Prévisions 7 jours" accessible depuis la navigation principale (timeline, code couleur, détail par zone)
- [x] Lien de navigation vers la page Prévisions dans le bandeau header (+ responsive mobile)
- [x] Tests vitest du module de prévision (12 tests OK)
- [x] Checkpoint V5

## V5.1 — Lien QRZ.com sur clic spot
- [x] Rendre chaque ligne du flux de spots cliquable
- [x] Ouvrir la fiche QRZ.com de l'indicatif DX dans un nouvel onglet (https://www.qrz.com/db/{CALL})
- [x] Feedback visuel au clic (cursor pointer, hover, tooltip)

## V5.2 — WebSDR contextuel par spot (TERMINÉ)
- [x] Base de données WebSDR mondiale (207 SDR HF dans 80 pays, locator+URL+type)
- [x] Correspondance préfixe DX → locator (table 80+ préfixes) + coordonnées lat/lon directes de Spothole
- [x] Calcul de proximité Haversine : 5 WebSDR/KiwiSDR les plus proches du DX
- [x] Procédure tRPC : spots.nearbyWebsdr(call, freqKhz, mode, dxLat, dxLon)
- [x] UI : panneau d'expansion au clic (QRZ.com + liste SDR proches + liens directs fréquence/mode)
- [x] Génération d'URL directes : WebSDR (?tune=14220usb), KiwiSDR (?f=14220.00/usb&z=10), OpenWebRX (#freq=14220000,mod=usb)
- [x] Responsive mobile
- [x] Tests Vitest dédiés module WebSDR (19 tests : proximité, fallback préfixe/lat-lon, génération d'URL) — 76/76 total
- [x] Checkpoint V5.2

## V5.3 — DX Summit comme source complémentaire (TERMINÉ)
- [x] Fetch DX Summit API (PHONE, toutes bandes HF) côté serveur
- [x] Normalisation des spots DX Summit au format Spothole (RawSpot)
- [x] Fusion + dédoublonnage (clé: dx_call + bande + fenêtre 2 min, Spothole prioritaire)
- [x] Marquage de la source (DXSummit / Spothole) visible dans l'UI (colonne Src)
- [x] Tests Vitest (normalisation, dédoublonnage, tolérance erreurs) — 19 tests dxsummit + 5 spots = 94/94 total
- [x] Checkpoint V5.3

## V5.4 — Self-Monitor (écoute de soi sur WebSDR par corridor de propagation) (TERMINÉ)
- [x] Logique backend : calcul du corridor de propagation (grand cercle depuis JN25PG, azimut donné, SP ou LP)
- [x] Classification des WebSDR par position relative au corridor (dans l'axe / nord / sud / îles-côtes)
- [x] Procédure tRPC : spots.selfMonitor(freqKhz, azimut, path: SP|LP) → SDR classés par secteur
- [x] Composant UI SelfMonitor : saisie fréquence + azimut + SP/LP, affichage résultats par secteur
- [x] Liens WebSDR directs pré-calés sur la fréquence et le mode
- [x] Système de favoris par corridor (localStorage) : marquer/démarquer un SDR, reproposé automatiquement
- [x] Onglet "Self-Monitor" dans la page Pilotage
- [x] Tests Vitest (15 tests corridor + classification) — 109/109 total
- [x] Checkpoint V5.4

## V5.4b — Self-Monitor dans la page Radar (TERMINÉ)
- [x] Intégrer le composant SelfMonitor dans la page Radar (Home.tsx) comme panneau pleine largeur sous le flux
- [x] Checkpoint V5.4b

## V5.4c — Drapeaux et continents sur les WebSDR (TERMINÉ)
- [x] Mapping pays (code ISO 2 lettres) → emoji drapeau + continent (shared/countryMeta.ts)
- [x] Afficher drapeau + continent dans le Self-Monitor (chaque ligne SDR)
- [x] Afficher drapeau + continent dans le panneau détail spot (WebSDR proches)
- [x] Checkpoint V5.4c

## V5.4d — Accessibilité daltonien : amélioration du contraste (TERMINÉ)
- [x] Palette bandes refaite : violet/bleu/cyan/jaune/orange/rose (pas de rouge/vert confondables)
- [x] Boutons continent : texte +70% luminosité inactif, ring + fond ambre quand actif
- [x] Modes SSB/CW/Digital : pastille colorée agrandie, ring actif, texte gras
- [x] DX rares : ambre au lieu de rouge (daltonien-friendly)
- [x] muted-foreground global +9% luminosité (0.66→0.72)
- [x] Checkpoint V5.4d

## V5.4e — Fix longitude inversée DX Summit + contraste daltonien
- [x] Bug fix : DX Summit fournit les longitudes avec le signe inversé → corrigé dans normalizeDxSummitSpot
- [x] Les WebSDR proches s'affichent maintenant correctement pour les spots DX Summit (ex: DK0ACI → SDR allemands)
- [x] Checkpoint V5.4e

## V6 — Page Multiplicateurs par concours (TERMINÉ)
- [x] Données de référence : zones CQ (40), zones ITU (90), pays DXCC, préfixes WPX, départements FR (96), DOM/TOM (13), stations HQ IARU
- [x] Module shared/contestMultipliers.ts : extraction des multiplicateurs depuis les spots en temps réel
- [x] Onglet CQ WPX : préfixes uniques (toutes bandes confondues)
- [x] Onglet CQ WW : zones CQ + pays DXCC, par bande, avec filtrage
- [x] Onglet IARU HFC (TM0HQ) : zones ITU + stations HQ IARU, par bande
- [x] Onglet Coupe du REF : départements FR + DOM/TOM + pays DXCC, par bande
- [x] Clic sur un multiplicateur → panneau détail avec stations (call, pays, fréquence, mode, lien QRZ)
- [x] Navigation depuis le header du Radar (bouton ambre « Multiplicateurs »)
- [x] Tests Vitest (21 tests contestMultipliers) — 130/130 total
- [x] Checkpoint V6

## V6.1 — Multiplicateurs : travaillés, alertes, export ADIF (TERMINÉ)
- [x] Compteur "travaillés" : cocher/décocher un multiplicateur comme acquis (persistance localStorage par concours)
- [x] Barre de progression : X travaillés / Y total, pourcentage, compteur manquants
- [x] Filtre "manquants uniquement" pour ne voir que les mults non travaillés
- [x] Alerte sonore nouveau multiplicateur : bip 4 tons quand un nouveau mult apparaît
- [x] Toast notification avec le détail du nouveau mult (label, type, bande, station)
- [x] Export ADIF : générer un fichier .adi avec les stations des multiplicateurs
- [x] Bouton ADIF dans le header + bouton Reset travaillés
- [x] Tests Vitest V6.1 (13 tests ADIF + worked + alertes) — 143/143 total
- [x] Checkpoint V6.1

## V6.2 — Refonte Self-Monitor (3 catégories + repliable) (TERMINÉ)
- [x] Logique backend : 3 catégories de SDR (local 0-500km, lointain 6000km+, côtes/îles dans l'axe ±30°)
- [x] SP/LP : calcul du corridor dans les deux sens
- [x] Composant repliable (bouton ▼/▲ avec mémorisation localStorage)
- [x] Affichage par catégorie avec distance, drapeau et continent
- [x] Favoris par corridor (localStorage)
- [x] Dédoublonnage des SDR dans la base (seenNames Set)
- [x] Tests Vitest (18 tests selfmonitor) — 146/146 total
- [x] Checkpoint V6.2

## V6.3 — Presets de direction Self-Monitor (TERMINÉ)
- [x] 6 boutons presets : US (300° SP), JA (35° SP), VK (110° LP), AF (180° SP), SA (230° SP), Caraïbes (270° SP)
- [x] Pré-remplissage automatique azimut + chemin SP/LP au clic
- [x] Lancement automatique de la recherche après sélection du preset
- [x] Preset actif surligné en primary
- [x] Checkpoint V6.3

## V7 — Propagation FT8 via PSK Reporter (indicateur temps réel par bande) (TERMINÉ)
- [x] Module serveur pskreporter.ts : connexion MQTT WebSocket à mqtt.pskreporter.info, filtre FT8, bandes contest (160/80/40/20/15/10m), SNR > -4 dB
- [x] Agrégation par bande + continent (locator tx → continent) sur fenêtre glissante 5 min
- [x] Procédure tRPC : spots.ft8Propagation → résumé propagation par bande et par continent (count, avgSnr, maxSnr)
- [x] Composant FT8Propagation.tsx : panneau dédié avec grille bande × continent, barres de force, filtre par bande
- [x] Indicateur connecté/déconnecté PSK Reporter
- [x] Tests Vitest (8 tests pskreporter) — 154/154 total
- [x] Vérifié : serveur connecté PSK Reporter, 4059 spots FT8 en mémoire, API répond correctement
- [x] Checkpoint V7

## V7.1 — Bandeau défilant Plan 24h + Pilotage multi-bandes
- [x] Modèle de propagation multi-bandes : données horaires par bande (160/80/40/20/15/10m) et par direction/zone
- [x] Bandeau défilant (ticker) Plan 24h dans le header principal : affiche heure par heure les recommandations (ex: "13:00 → Run EU zone proche, cap 90-120°")
- [x] Placement du bandeau à côté de "Prévisions 7j" dans la navigation
- [x] Pilotage par bande : sélecteur de bande dans la page Pilotage (au lieu de fixé 40m)
- [x] Pilotage général : vue d'ensemble toutes bandes avec créneaux optimaux par direction
- [x] Sélecteur mode pilotage (par bande / général) dans la page Pilotage
- [x] Adaptation du lien header : "Pilotage TM0HQ 40m" → dynamique selon la bande sélectionnée
- [x] Tests Vitest pour le modèle multi-bandes (15 tests propagationMultiBand) — 169/169 total
- [x] Checkpoint V7.1

## V7.2 — Calibration multi-bandes (toutes bandes au lieu de 40m seul)
- [x] Modifier la logique de calibration backend pour capturer les spots sur les 6 bandes contest (160/80/40/20/15/10m)
- [x] Adapter le schéma DB : colonne `band` + clé unique (snapDate, hourUtc, band, zoneId)
- [x] buildSnapshot génère 6 bandes × 14 zones = 84 lignes par capture
- [x] countSpotsByZone filtre par bande
- [x] predictScore accepte un paramètre `band` et utilise le profil multi-bandes
- [x] calibratedScores accepte un paramètre `band` pour l'apprentissage par bande
- [x] Adapter le composant UI CalibrationJournal : sélecteur de bande + groupement par bande+zone
- [x] Tests Vitest mis à jour pour la calibration multi-bandes — 177/177 total
- [x] Checkpoint V7.2

## V7.3 — Détection FT8 par fréquence + filtre FT8 séparé
- [x] Détection FT8/FT4 par fréquence (7074, 14074, 21074, 28074 kHz etc.) même si le cluster étiquette USB
- [x] Séparation ModeFamily : SSB / CW / FT8 / DIGI / AUTRE (FT8 est maintenant une catégorie à part)
- [x] Filtre "FT8 / FT4" dans le panneau Modes (à côté de SSB et CW)
- [x] FT8 actif par défaut dans les filtres (SSB + CW + FT8)
- [x] Tests Vitest (16 tests dx.test.ts) — 183/183 total
- [x] Checkpoint V7.3

## V7.4 — MUF temps réel via ionosondes GIRO DIDBase
- [x] Endpoint backend tRPC `spots.muf` : fetch foF2 de Dourbes (DB049) et Rome (RO041) via GIRO API
- [x] Calcul MUF = moyenne(foF2) × 3 avec cache 5 minutes côté serveur
- [x] Composant UI MufIndicator dans le header principal avec foF2 des 2 stations + MUF calculée
- [x] Intégration dans le bandeau solaire existant (à côté du SFI/K-index)
- [x] Tests Vitest pour le parsing des données GIRO et le calcul MUF (7 tests, 190/190 total)
- [x] Checkpoint V7.4

## V7.5 — Filtre flux DX par bande + limite 1h
- [x] Limiter le flux DX en direct aux spots de la dernière heure (60 min max)
- [x] Filtre par bande déjà existant dans FilterPanel (boutons 160/80/40/20/15/10m) — vérifié fonctionnel
- [x] Checkpoint V7.5

## V7.6 — Carte DX : zones ITU + mode plein écran
- [x] Afficher les zones ITU sur la carte DX (cercles + numéros ITU)
- [x] Rendre la carte cliquable pour s'agrandir en plein écran (modal/overlay)
- [x] En plein écran : voir les spots positionnés + zones ITU + légende bandes + QTH
- [x] Checkpoint V7.6

## V7.8 — FT8 Propagation : filtre par zone ITU de réception
- [x] Ajouter locatorToItuZone dans pskreporter.ts (conversion grid Maidenhead → zone ITU)
- [x] Stocker rxItuZone dans chaque spot FT8 (calculé depuis rxGrid)
- [x] Modifier getPropagationSummary pour accepter un filtre rxItuZone optionnel
- [x] Ajouter endpoint tRPC ft8ZoneStats pour les stats par zone
- [x] Modifier le composant FT8Propagation : sélecteur zone ITU (27=France par défaut, + 28 Sud EU, 29 Est EU, 18 Scand., 16 Russie, MONDE)
- [x] Afficher le nombre de spots filtrés vs total
- [x] Tests Vitest pour locatorToItuZone et filtrage par zone (14 tests, 219/219 total)
- [x] Checkpoint V7.8

## V7.9 — Système WebSDR intelligent avec favoris (SelfMonitor + SpotDetail)
- [x] Schéma DB : table `websdr_favorites` (id, visitorId, sdrName, sdrUrl, lat, lon, note, createdAt)
- [x] Schéma DB : table `websdr_deleted` (id, visitorId, sdrName, sdrUrl, createdAt) — SDR supprimés ne réapparaissent plus
- [x] Migration DB (`pnpm db:push`)
- [x] Backend : helpers db.ts pour favoris (add, remove, list) et deleted (add, list)
- [x] Backend : procédures tRPC — websdr.addFavorite, websdr.removeFavorite, websdr.listFavorites, websdr.deleteSdr, websdr.listDeleted, websdr.restoreDeleted
- [x] Backend : procédure publique websdr.bestForDx + websdr.smartCorridor — sélection intelligente avec favoris prioritaires et supprimés exclus
- [x] Algorithme de sélection intelligente : score par (1) favori dans la bonne direction, (2) proximité au DX/corridor, (3) couverture de bande
- [x] Frontend SelfMonitor : bouton étoile (favori) + bouton supprimer sur chaque ligne SDR, favoris persistés en DB
- [x] Frontend SpotDetail : utiliser la sélection intelligente (meilleurs SDR pour la direction/bande du DX), bouton étoile/supprimer
- [x] Frontend : si non connecté, favoris via visitorId localStorage ; si connecté, utilise openId
- [x] Tests Vitest pour l'algorithme de sélection (14 tests websdrSmart.test.ts) — 233/233 total
- [x] Checkpoint V7.9

## V7.9.1 — Self-Monitor : inclure 1-2 WebSDR locaux (proches du QTH)
- [x] Ajout de 13 KiwiSDR proches de JN25 à websdr-db.json (linkz 15km, F6ABJ 20km, F4VUK 129km, HB3YQQ 168km, HB9EXC 171km, HB9ADJ 175km, F4JOY 185km, Ecublens 190km, HB9HZW 198km)
- [x] Garantie minimum 2 SDR locaux dans l'algorithme smartCorridor (LOCAL_MIN_COUNT=2, fallback si < 2)
- [x] Vérification : Self-Monitor affiche bien linkz (15 km) et F6ABJ (20 km) en tête de la section locale
- [x] Checkpoint V7.9.1

## V7.9.2 — Bouton SPOT (poster un spot DX Summit depuis le Self-Monitor)
- [x] Backend : procédure tRPC websdr.postSpot (POST vers http://www.dxsummit.fi/api/v1/spots)
- [x] Champ indicatif SWL (de_call) pré-rempli F-13807, mémorisé en localStorage
- [x] Champ indicatif DX (dx_call) à saisir (ex: TM0HQ)
- [x] Commentaire par défaut "cq cq cq 5/9" modifiable
- [x] Bouton SPOT dans le Self-Monitor qui envoie le spot
- [x] Feedback visuel (toast succès/erreur)
- [x] Checkpoint V7.9.2

## V7.10 — Carte des zones CQ interactive (remplacement de la carte DX)
- [x] Remplacer WorldMap par une carte des zones CQ (style EI8IC, colorée par continent, zones 1-90 numérotées)
- [x] Afficher les spots du flux DX comme marqueurs sur la carte (positionnés par lat/lon)
- [x] Hover sur un marqueur → afficher l'indicatif (call) de la station
- [x] Clic sur un marqueur → afficher les infos complètes du spot (indicatif, fréquence, mode, pays, commentaire)
- [x] Checkpoint V7.10

## V7.11 — Compteur de visiteurs connectés en temps réel
- [x] Backend : endpoint de présence (heartbeat ping/pong) avec compteur in-memory
- [x] Frontend : hook usePresence qui envoie un ping toutes les 30s et récupère le nombre de connectés
- [x] Affichage dans le header entre l'horloge UTC et le badge EN LIGNE
- [x] Checkpoint V7.11

## V7.12 — Prévisions par bande : détail heure par heure
- [x] Rendre chaque bande cliquable dans le panneau Prévisions 7J
- [x] Au clic sur une bande → afficher les prévisions heure par heure pour cette bande (direction, azimut, score)
- [x] Garder la vue résumé (toutes les bandes) accessible en cliquant "Retour" ou en désélectionnant
- [x] Checkpoint V7.12

## V7.13 — Bouton "FAIT" dans le flux DX (marquer les indicatifs déjà contactés)
- [x] Schéma DB : table `worked_calls` (id, visitorId, dxCall, band, contestId, createdAt) + index unique
- [x] Backend : procédures tRPC — worked.add, worked.remove, worked.list
- [x] Frontend SpotRow : bouton "FAIT" à côté de la bande, clic → marque comme fait (vert)
- [x] Visuel : indicatifs marqués FAIT → ligne grisée (opacity 40%) + indicatif barré
- [x] Re-clic sur FAIT → annule le marquage (toggle)
- [x] Hook useWorkedCalls avec Set pour lookup rapide + persistance DB
- [x] 233/233 tests OK
- [x] Checkpoint V7.13

## V7.15 — WebSocket flux DX Cluster pour Win-Test / DXLog
- [x] Endpoint WebSocket `/api/ws/cluster` qui diffuse les spots en format DX Cluster standard
- [x] Format : `DX de <spotter>:  <freq>  <dx_call>  <comment>  <time>Z`
- [x] Script Python relay : WebSocket → serveur Telnet local (localhost:7300)
- [x] Win-Test/DXLog se connecte sur localhost:7300 et reçoit les spots filtrés
- [x] Tests Vitest (7 tests clusterWs) — 240/240 total
- [x] Checkpoint V7.15

## V7.15c — Règle LSB/USB globale (< 10 MHz = LSB partout)
- [x] Auditer server/websdr.ts : mapMode() corrigé pour forcer LSB/USB par fréquence
- [x] Auditer client : SpotDetail, SpotRow, WorldMap, Home, Multipliers — tous utilisent displayMode()
- [x] Auditer client : Self-Monitor — hérite via buildTuneUrl() côté serveur
- [x] Auditer client/src/lib/dx.ts : ajouté displayMode() helper
- [x] Auditer shared/ : pas de mapping mode dans shared (OK)
- [x] Vérifier que le flux Cluster (déjà corrigé) est cohérent
- [x] Tests Vitest mis à jour (248/248 OK)
- [x] Checkpoint V7.15c

## V7.18 — Détection propagation sporadique + Filtres avancés (style DX Summit)
- [x] Recherche : propagation sporadique (Es, TEP, Tropo, MS, Aurora, F2, Backscatter)
- [x] Backend : module propagationDetector.ts — analyse mots-clés + distance + burst VHF
- [x] Backend : procédures tRPC spots.propagationOpenings + spots.vhfActivity
- [x] Backend : extension TRACKED_BANDS serveur avec VHF (6m, 4m, 2m, 70cm)
- [x] Backend : extension freqToBand() avec bandes VHF/UHF
- [x] Backend : DX Summit URL étendue avec 50/70/144/430 MHz
- [x] Frontend : composant PropagationAlert (bandeau clignotant + panneau détail)
- [x] Frontend : extension FilterPanel avec section VHF/UHF dépliable
- [x] Frontend : toggle "Alerte sporadique" dans les filtres
- [x] Frontend : extension ALL_BANDS / VHF_BANDS / BAND_COLORS dans dx.ts
- [x] Frontend : useSpots étendu pour accepter les spots VHF
- [x] Tests Vitest propagationDetector (18 tests) — 274/274 total
- [x] Checkpoint V7.18

## V7.19 — WhatsApp + Multilingue + Branding DX Daruma
- [x] Upload logo Groupe Daruma en asset statique
- [x] Remplacer "DX Center" / "DX Hunter" par "DX Daruma" + logo Groupe Daruma
- [x] Créer système i18n (contexte React + fichiers de traduction FR/EN/DE/PL/ES/IT)
- [x] Sélecteur de langue avec drapeaux dans la barre de menu (header)
- [x] Traduire les textes principaux (header, filtres, alertes, panneau détail, multiplicateurs)
- [x] Bouton WhatsApp flottant (lien wa.me/+33642038000)
- [x] Tests et vérification (274/274 OK)
- [x] Checkpoint V7.19

## V8.0 — Système Premium + Admin + Landing + WARC + Documentation

### Backend
- [x] Ajouter champ `subscription` (enum: free/premium) + `subscriptionExpiry` dans table users
- [x] Créer `premiumProcedure` qui bloque l'accès aux fonctions premium si user.subscription != premium
- [x] Protéger les routes premium : Self-Monitor, Multiplicateurs, Pilotage, Prévisions, alertes sporadiques
- [x] Laisser en accès gratuit : flux DX Cluster (spots.list)
- [x] Créer router admin : lister users, toggle premium, voir emails
- [x] Restreindre admin au owner (OWNER_OPEN_ID)

### Frontend — Landing page
- [x] Page d'accueil publique (/) avec présentation du logiciel
- [x] Bouton "Se connecter" / "S'inscrire" (Manus OAuth)
- [x] Section tarifs : Gratuit (cluster) vs Premium (50$/an, accès complet)
- [x] Bouton PayPal "Passer Premium" → lien paypal.me/f4ivv ou envoi à f4ivv@orange.fr
- [x] Message post-paiement : "Votre accès sera activé sous 24h après vérification"

### Frontend — Gate Premium
- [x] Composant PremiumGate : bloque l'accès aux pages premium avec message upgrade
- [x] Appliquer PremiumGate sur : /pilot, /multipliers, /forecast, SelfMonitor, PropagationAlert
- [x] Utilisateurs gratuits voient le cluster + un aperçu flou/verrouillé des fonctions premium

### Frontend — Panneau Admin
- [x] Page /admin (accessible uniquement au owner)
- [x] Liste des utilisateurs avec email, date inscription, statut (free/premium)
- [x] Bouton "Activer Premium" / "Révoquer Premium" par utilisateur
- [x] Compteur total users / premium / free

### Filtres bandes
- [x] Refonte visuelle : boutons colorés quand sélectionnés, grisé/noir quand désélectionnés
- [x] Ajouter groupe WARC (30m / 17m / 12m) en section séparée
- [x] Conserver les groupes : HF classiques, WARC, VHF/UHF

### Documentation
- [x] Page /docs multilingue (FR/EN/DE/PL/ES/IT)
- [x] Sections : Présentation, Flux DX, Self-Monitor, Multiplicateurs, Pilotage, Prévisions, Alertes sporadiques, Filtres, Win-Test relay
- [x] Accessible depuis la landing page et le menu

### Finalisation
- [x] Tests Vitest
- [x] Checkpoint V8.0

## V8.0 — Système Premium, Landing, Admin, WARC, Docs multilingues
- [x] Schema DB : champs subscription (enum free/premium), subscriptionExpiry, locator dans table users
- [x] Middleware premiumProcedure dans server/_core/trpc.ts
- [x] Helpers DB : listAllUsers(), setUserSubscription(), updateUserLocator()
- [x] Router admin tRPC (listUsers, setSubscription)
- [x] Procédure profile.setLocator dans routers.ts
- [x] Système i18n : ~40 nouvelles clés Landing/Pricing/Locator pour les 6 langues (FR/EN/DE/PL/ES/IT)
- [x] Page Landing (/) : hero, features, pricing PayPal (50$/an), locator prompt, footer WhatsApp
- [x] Fix getLoginUrl() : accepte returnPath optionnel pour redirection post-login
- [x] Fix logo Daruma dans Landing.tsx (chemin correct /manus-storage/daruma-logo_7b6015da.jpeg)
- [x] Routing : / → Landing, /app → Home (DX Cluster), /admin, /docs
- [x] Page Admin (/admin) : tableau utilisateurs, activation/révocation Premium, recherche
- [x] Page Docs (/docs) : documentation multilingue complète (6 langues) avec table des matières
- [x] Composant PremiumGate : bloque l'accès aux fonctions premium (Self-Monitor, Multipliers, etc.)
- [x] Refonte filtres bandes : WARC_BANDS (30m/17m/12m) ajoutées avec couleurs dédiées
- [x] FilterPanel : section WARC entre HF et VHF/UHF
- [x] DEFAULT_FILTERS inclut les bandes WARC
- [x] Lazy loading des pages (code splitting) dans App.tsx
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.0

## V8.1 — Locator dynamique + langue globale
- [x] Audit : identifier tous les endroits où JN25PG est codé en dur (backend + frontend)
- [x] Backend : selfMonitor et smartCorridor acceptent un paramètre `locator` optionnel
- [x] Backend : convertir locator → lat/lon et passer aux fonctions de calcul
- [x] Frontend : WorldMap affiche le QTH dynamique selon le locator de l'utilisateur
- [x] Frontend : Pilot.tsx affiche le locator de l'utilisateur au lieu de JN25PG
- [x] Frontend : Forecast.tsx affiche le locator de l'utilisateur
- [x] Frontend : SelfMonitor passe le locator de l'utilisateur au backend
- [x] Langue : Home.tsx traduit (sections, boutons, badges connexion, états vides)
- [x] Langue : NavBar.tsx traduit (sous-titre, label Pilotage)
- [x] Langue : 24 nouvelles clés i18n ajoutées dans les 6 langues
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.1

## V8.2 — Notification automatique à chaque nouvelle inscription
- [x] Déclencher notifyOwner() lors de la première connexion d'un nouvel utilisateur
- [x] Contenu de la notification : nom/indicatif, email, date d'inscription
- [x] Lien vers /admin dans la notification pour activer Premium rapidement
- [x] Tests + Checkpoint V8.2

## V8.4 — Badge Premium, lien connexion Landing, page Profil
- [x] NavBar : badge "Premium" ou "Gratuit" à côté du nom d'utilisateur
- [x] Landing page : lien/bouton "Connexion" dans la section pricing
- [x] Page /profile : afficher locator, statut abonnement, date expiration
- [x] Page /profile : formulaire pour modifier le locator
- [x] Route /profile dans App.tsx + lien dans NavBar (icône User cliquable)
- [x] Tests + Checkpoint V8.4

## V8.5 — Traduction Profil, distance/azimut spots, bienvenue
- [x] Page Profil : traduire tous les textes en 6 langues (FR/EN/DE/PL/ES/IT)
- [x] SpotRow : afficher distance (km) et azimut (°) depuis le locator utilisateur
- [x] Notification de bienvenue envoyée au owner quand un nouvel utilisateur s'inscrit (déjà fait V8.2, vérifié)
- [x] Tests + Checkpoint V8.5

## V8.6 — Distance/azimut dans SpotDetail
- [x] Afficher distance (km) et azimut (°) dans le panneau SpotDetail quand on clique sur un spot
- [x] Tests + Checkpoint V8.6

## V8.7 — Système CAT FlexRadio
- [x] Recherche SmartSDR TCP/IP API (protocole, commandes slice/tune/mode)
- [x] CAT Bridge Node.js standalone (cat-bridge/bridge.mjs) — zéro dépendance
- [x] Hook React useFlexCat (WebSocket, auto-reconnect, QSY)
- [x] Bouton QSY dans SpotDetail — envoie freq+mode au FlexRadio
- [x] Indicateur CAT dans NavBar (FLEX vert / BRIDGE orange / CAT gris)
- [x] Documentation README dans cat-bridge/
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.7

## V8.8 — CAT Bridge Universal Edition (tous postes)
- [x] Bridge universel : support FlexRadio (TCP), Hamlib (TCP), Yaesu (série), Icom CI-V (série), Kenwood (série), Elecraft (série)
- [x] Documentation complète : guide Mac/PC/Linux, tous postes, dépannage, FAQ, architecture
- [x] Scripts de lancement rapide : start-bridge.bat (Windows) + start-bridge.sh (Mac/Linux)
- [x] Mapping modes DX Cluster → modes natifs par fabricant
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.8

## V8.9 — Paramètres CAT, fréquence temps réel, Split
- [x] Panneau "Paramètres CAT" dans l'interface (configurer IP/port du Bridge sans CLI)
- [x] Afficher la fréquence actuelle du poste en temps réel dans la NavBar
- [x] Bouton "Split" dans SpotDetail (TX sur une fréquence, RX sur une autre)
- [x] Sélecteur d'offset Split (+1, +2, +5, +10, -5, -10 kHz)
- [x] Commande split ajoutée au Bridge (XIT FlexRadio)
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.9
## V8.10 — Locator dynamique dans TOUTES les fonctions de propagation
- [x] `server/calibration.ts` : `predictScore` et `pathMaxLatitude` acceptent un param `qth` optionnel (DEFAULT_QTH en fallback)
- [x] `server/routers/spots.ts` : `calibratedScores` accepte un param `locator` et le passe à `predictScore`
- [x] `server/routers/spots.ts` : `forecast7d` accepte un param `locator` et le passe à `computeForecast7d`
- [x] `server/forecast.ts` : `computeForecast7d` et `computeZoneDayScores` acceptent `qth` optionnel
- [x] `client/src/lib/propagation.ts` : `evaluateZone`, `evaluateAllZones`, `pathMaxLatitude`, `sunTimesQTH` acceptent `qth` optionnel
- [x] `client/src/lib/pilot.ts` : `buildRecommendations` et `buildTimeline` acceptent `qth` optionnel
- [x] `client/src/hooks/usePilot.ts` : passe `qth` à `buildRecommendations` et `buildTimeline`
- [x] `client/src/pages/Pilot.tsx` : passe `userQth` à `usePilot`
- [x] `client/src/pages/Forecast.tsx` : passe `locator: userLocator` à la query `forecast7d`
- [x] `client/src/lib/propagationMultiBand.ts` : `buildBandTimeline`, `buildGeneralTimeline`, `getTickerSlots` acceptent `qth` (déjà fait V8.1)
- [x] `client/src/components/PilotGeneral.tsx` : passe `qth` aux fonctions multi-bandes (déjà fait V8.1)
- [x] `client/src/components/PlanTicker.tsx` : passe `qth` à `getTickerSlots` (déjà fait V8.1)
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.10
## V8.11 — Dialogue modal de saisie du locator à la première connexion
- [x] Composant LocatorPrompt modal (Dialog shadcn/ui)
- [x] Validation du format Maidenhead (4 ou 6 caractères)
- [x] Mutation tRPC pour sauvegarder le locator (réutiliser profile.setLocator existant)
- [x] Traductions i18n dans les 6 langues (FR/EN/DE/PL/ES/IT)
- [x] Intégration dans le flux app : afficher le modal quand user connecté + locator vide/null
- [x] Tests + Checkpoint V8.11
## V8.12 — Bug fix : zone ITU dynamique dans FT8 Propagation
- [x] FT8Propagation : la zone ITU "Ma zone" doit être calculée dynamiquement à partir du locator de l'utilisateur (pas hardcodée zone 27)
- [x] Ajouter le locator Alaska (BQ) à ituZoneFromLatLon si manquant
- [x] Tests + Checkpoint
## V8.13 — Carte de propagation dans Forecast
- [x] Composant ForecastMap (SVG, projection équirectangulaire, cercles colorés par score)
- [x] Intégration dans Forecast.tsx (carte du jour 1 affichée après la légende)
- [x] Lignes QTH → zones avec couleur dynamique
- [x] 274/274 tests OK, 0 erreurs TypeScript
- [x] Checkpoint V8.13
## V8.14 — Table ITU zones complète (toutes les zones mondiales)
- [x] Réécriture complète de ituZoneFromLatLon : 50+ zones couvertes (pôles, Amériques, Europe, Asie, Afrique, Océanie, Pacifique, Atlantique, Océan Indien)
- [x] Fallback par quadrant pour les cas non couverts (jamais null)
- [x] ZONE_NAMES étendu à toutes les zones (75 entrées)
- [x] Frontière EU Ouest/Est corrigée (lon 12° → Berlin en zone 28)
- [x] Zone 30 (Asie Centrale) étendue jusqu'à lon 90° pour couvrir le Kazakhstan
- [x] BL11 → zone 61 (Hawaii) vérifié ✓
- [x] 274/274 tests OK, 0 erreurs TypeScript
## V8.15 — Système Trial / Free / Premium
- [x] Schéma DB : ajouter champs trialStartDate et subscriptionStatus à la table user
- [x] Backend : procédure tRPC pour récupérer le statut d'abonnement (trial actif, jours restants, expiré, premium)
- [x] Frontend : hook useSubscription pour accéder au statut partout
- [x] Frontend : composant PremiumGate qui grise les sections verrouillées avec badge "Premium"
- [x] Verrouiller après trial : WebSDR, Prévisions 7j, Pilotage, Propagation FT8 live (seul le DX Cluster reste accessible)
- [x] Compteur de jours restants visible dans l'interface (bandeau ou badge)
- [x] Tests + Checkpoint

## V8.17 — Intégration CAT FlexRadio (QSY depuis DX Hunter)
- [x] Script bridge Node.js pour Mac (HTTP → TCP CAT port 5001) [existait déjà dans cat-bridge/bridge.mjs]
- [x] Bouton QSY sur chaque spot dans le flux DX
- [x] Page settings CAT dans DX Hunter (déjà dans Pilotage)
- [x] Instructions d'installation du bridge pour l'utilisateur (README dans dxhunter-cat-bridge/)
- [x] Tests + Checkpoint

## V8.18 — CAT Relay Cloud HTTP (résout Mixed Content HTTPS → ws://localhost)
- [x] Router tRPC cat.push / cat.state / cat.command (HTTP, compatible serverless Autoscale)
- [x] Hook useFlexCat réécrit : polling tRPC toutes les 1.5s (plus de WebSocket côté browser)
- [x] NavBar simplifiée : plus besoin de configurer l'URL du bridge manuellement
- [x] Script bridge-relay.mjs v5 : HTTP POST natif (fetch), zéro dépendance npm
- [x] Authentification bridge via token (CAT_BRIDGE_TOKEN)
- [x] Détection bridge stale (>5s sans push → bridgeAlive=false)
- [x] File de commandes browser→bridge (QSY, split) via cat.command/cat.push

## V9 — Calibrage FT8 par continent + Widget Prévisions Radar

### Backend : Snapshots horaires FT8
- [x] Nouvelle table `propagation_ft8_hourly` (snapDate, hourUtc, band, continent, spotCount, avgSnr, maxSnr, dominantAzimuth, sfi, kp)
- [x] Migration `pnpm db:push`
- [x] Agrégation FT8 avec seuil SNR >= -8 dB (exploitable SSB) par bande × continent sur 60 min
- [x] Calcul d'azimut dominant depuis QTH utilisateur vers chaque continent
- [x] Handler Heartbeat `/api/scheduled/ft8-hourly` (enregistrement toutes les heures)
- [x] Helpers db.ts : saveFt8HourlySnapshot (upsert), listFt8HourlySnapshots, getFt8History

### Backend : Endpoint temps réel (30 min)
- [x] Procédure tRPC `spots.ft8Directions` : agrège les 30 dernières min de FT8 (SNR >= -8) par bande × continent
- [x] Retourne : continents ouverts, spotCount, avgSnr, azimut depuis QTH, direction cardinale
- [x] Prédiction "prochaine ouverture probable" basée sur l'historique (même heure, même saison, SFI similaire)

### Frontend : Widget Prévisions DX sur page Radar
- [x] Encart compact "Prévisions DX" dans la page Radar
- [x] Indicateur boussole/compas avec azimut dominant en degrés
- [x] Badges par bande montrant les directions ouvertes (continent + azimut)
- [x] Code couleur : vert (forte ouverture SNR > -2), ambre (modérée -8 à -2), gris (fermé)
- [x] "Prochaine ouverture probable" basée sur les patterns historiques
- [x] Tests Vitest (291/291 OK) + Checkpoint

### Cron Heartbeat FT8 horaire
- [x] Activer le job Heartbeat `/api/scheduled/ft8-hourly` (toutes les heures) pour accumuler l'historique
- [x] Vérifier que le cron est bien enregistré dans le système (task_uid: kL8dbDkCXs5FKfYY8C4zJX)

### Filtrage EU exclu dans Prévisions DX
- [x] Ajouter un toggle "DX uniquement" dans le widget Prévisions DX (exclut EU)
- [x] Persister le choix dans localStorage
- [x] Appliquer le filtre côté client (ne pas afficher les continents EU dans la grille)

### LP/SP (Long Path / Short Path) dans Prévisions DX et FT8
- [x] Calculer SP et LP (360° - SP) pour chaque continent depuis QTH JN25
- [x] Détecter si un spot FT8 arrive en LP (azimut réel via txGrid vs théorique)
- [x] Afficher LP/SP dans le widget Prévisions DX (compas + grille, badge ambre LP)
- [x] LP affiché dans la direction dominante et dans chaque badge continent

## V10 — Intégration SDC + Mode Contest

### Relay Telnet (DX Hunter → SDC)
- [x] Script Node.js telnet-relay.mjs exposant un serveur Telnet sur localhost:7300
- [x] Connexion WebSocket à DX Hunter /api/ws/cluster
- [x] Retransmission des spots en format texte DX Cluster standard
- [x] Gestion multi-clients (SDC + autres logiciels)
- [x] Téléchargeable depuis le popover CAT de DX Hunter

### Réception QSO temps réel (SDC → DX Hunter)
- [x] Écoute UDP broadcast de SDC dans le bridge (telnet-relay.mjs)
- [x] Parsing du format QSO SDC (N1MM compatible UDP)
- [x] Envoi HTTP des QSO au serveur DX Hunter
- [x] Endpoint serveur /api/contest/qso pour recevoir et stocker les QSO contest

### Mode Contest backend
- [x] Table contest_sessions (concours actif, catégorie, bandes, date début/fin)
- [x] Table contest_qsos (QSO du contest en cours, call, band, multi reçu)
- [x] Règles multiplicateurs : CQWW SSB (zone CQ + DXCC par bande)
- [x] Règles multiplicateurs : CQWPX SSB (préfixes par bande)
- [x] Règles multiplicateurs : ARRL DX (états US + provinces VE par bande)
- [x] Règles multiplicateurs : REF SSB (départements FR + DXCC par bande)
- [x] Détection multi en temps réel sur chaque spot

### Mode Contest UI
- [x] Panneau activation "Mode Contest" (choix concours + catégorie + indicatif)
- [x] Couleur flashy (doré + badge MULTI pulsant) = nouveau multiplicateur
- [x] Couleur grisée (opacity-30) = indicatif déjà fait dans le contest
- [x] Couleur normale = indicatif à faire
- [x] Clic sur multi clignotant → détails (bandes, fréquences, modes)
- [x] Liste des multiplicateurs par bande (départements REF, zones CQ, etc.)

## V11 — Bouton rotor dans les prévisions DX
- [x] Bouton envoi azimut au rotor à côté de la boussole dans les prévisions DX (comme le QSY sur les spots)

## V12 — Contest RSGB IOTA
- [x] Profil contest IOTA dans contestRules.ts (extractMultipliers, bandes, multiTypes)
- [x] Extraction de référence IOTA (format XX-NNN) depuis échange/commentaire/iotaRef
- [x] Multiplicateurs par bande ET par mode (CW/SSB séparément)
- [x] Intégration contestEndpoint.ts (passage mode + iotaRef + comment au spotInfo)
- [x] Client useContestStatus : règle IOTA (pas de détection côté client, backend only)
- [x] ContestMultList : affichage dynamique des références IOTA travaillées par bande
- [x] MultiDetailPopover : cas IOTA (référence IOTA depuis échange)
- [x] Type ContestId mis à jour (shared/contestMultipliers.ts)
- [x] Tests vitest IOTA (11 tests : extractIotaRef + extractMultipliers) — 302/302 total

## V12.1 — Carnet de trafic contest (ouverture auto) + Prévisions DX contest-aware
- [x] Procédure tRPC contest.listQsos (50 derniers QSOs de la session active)
- [x] Composant ContestLog : tableau des QSOs de la session active
- [x] Colonnes adaptées par type de contest (IOTA: heure, call, bande, mode, RST, réf IOTA, serial, multi)
- [x] Ouverture automatique du carnet quand une session contest est démarrée
- [x] Rafraîchissement temps réel (polling 5s)
- [x] Indicateur visuel des nouveaux multiplicateurs dans le log
- [x] DxDirections filtré par bandes du contest actif
- [x] DxDirections filtré par modes du contest actif (SSB/CW)

## V12.2 — Log de concours intégré (saisie manuelle + score + Cabrillo)
- [x] Procédure tRPC contest.logQso (saisie manuelle : call, rstSent, rstRcvd, exchange, band, mode, freq)
- [x] Numérotation automatique des QSOs (serial number incrémental)
- [x] Formulaire de saisie rapide dans le panneau Contest (champs pré-remplis bande/mode/RST)
- [x] Validation : call non vide, détection dupe (même call + même bande)
- [x] Calcul du score temps réel (points × multiplicateurs) affiché dans le panneau
- [x] Export Cabrillo (bouton téléchargement fichier .cbr)
- [x] Mise à jour auto du log et des multiplicateurs après chaque saisie

## V12.3 — Super Check Partial + API QRZ XML
- [x] Télécharger et intégrer le fichier MASTER.SCP (base d'indicatifs actifs en contest)
- [x] Procédure tRPC contest.scp (recherche partielle dans la base SCP)
- [x] Intégrer l'API QRZ XML (session + lookup callsign → nom, pays, QTH, locator)
- [x] Auto-complétion SCP dans le formulaire de saisie contest (suggestions pendant la frappe)
- [x] Affichage infos QRZ sous le champ call (pays, nom, QTH) après validation
- [x] Secret QRZ_USERNAME et QRZ_PASSWORD pour l'API XML

## V13 — Log de trafic quotidien (carnet permanent)
- [x] Schema DB logbook (table qsoLog déjà existante avec tous les champs nécessaires)
- [x] Procédures tRPC logbook (add, list, delete, stats, exportAdif, importAdif, rebuildDxcc)
- [x] Composant LogBook UI : formulaire de saisie + tableau des QSOs récents (page /logbook)
- [x] Intégration SCP + QRZ dans le formulaire logbook (AddQsoForm enrichi avec auto-complétion SCP + lookup QRZ)
- [x] Pré-remplissage automatique depuis le QSY d'un spot (call, freq, bande, mode, pays, infos QRZ) — LogQsoDialog s'ouvre au clic QSY
- [x] Bascule mode contest : quand contest actif, LogQsoDialog propose le double log (logbook + contest_qsos)
- [x] Accessible depuis la navigation principale (onglet/page Log)
- [x] Export ADIF du log quotidien

## V13b — Affichage date/heure UTC dans le log
- [x] Afficher la date et l'heure UTC dans le LogQsoDialog (visible et éditable)
- [x] Afficher la date/heure UTC dans le formulaire AddQsoForm du Logbook (déjà existant avec datetime-local en UTC)

## V13c — Bouton FAIT ouvre toujours le LogQsoDialog (pas seulement en mode contest)
- [x] Le clic FAIT sur un spot ouvre systématiquement le LogQsoDialog (log quotidien) quel que soit le mode
- [x] Supprimer la condition contestMode sur l'ouverture du dialog dans onMarkWorked

## V13d — Log inline dans le SelfMonitor (REMPLACÉ par RunModeLog ci-dessous)
- [x] Intégrer un formulaire de log inline (composant RunModeLog, affiché au-dessus du SelfMonitor)
- [x] Pré-remplir automatiquement fréquence et mode depuis l'état CAT du rig
- [x] Si un spot est sur la fréquence (±2 kHz), l'afficher comme suggestion cliquable (pré-remplit l'indicatif)
- [x] L'utilisateur n'a qu'à compléter (indicatif, RST, notes) et valider
- [x] Le log va dans le logbook quotidien (+ contest si bascule active)

## V13d — Mode Run : log inline avec aide à l'identification
- [x] Créer composant RunModeLog (formulaire persistant, affiché quand radio connectée)
- [x] Pré-remplir freq/mode depuis l'état CAT du rig (useFlexCat currentFreq/currentMode)
- [x] Date/heure UTC enregistrée automatiquement à la validation (horodatage instantané)
- [x] Aide à l'identification : spots actifs sur la fréquence courante (±2 kHz) affichés comme suggestions cliquables
- [x] Direction antenne (azimut rotor via useRotor) affichée pour orienter l'opérateur
- [x] Auto-complétion SCP sur le champ indicatif (navigation clavier ↑↓ Tab Enter)
- [x] Lookup QRZ automatique debounced (pays, nom, QTH, locator, IOTA, zone CQ)
- [x] À la validation : enregistre le QSO, vide le champ indicatif, reste ouvert pour le suivant
- [x] Bascule contest disponible si session active (double log logbook + contest)

## V13e — SelfMonitor suit la fréquence du rig
- [x] Le SelfMonitor reçoit la fréquence CAT du rig en prop et met à jour automatiquement
- [x] Quand la fréquence change sur le VFO (>5 kHz), le SelfMonitor relance la recherche WebSDR
- [x] Synchroniser aussi le mode (SSB/CW) et l'azimut rotor depuis le rig

## V13f — QSY unifié : log + kiwi + rotor en un clic
- [x] Au clic QSY sur un spot : CAT (freq/mode) + pré-remplir RunModeLog (REMPLACÉ par V13f ci-dessous, sans rotor auto)
- [x] Le SelfMonitor suit automatiquement (déjà fait via props rig)
- [x] Toast QSY conservé tel quel (rotor piloté manuellement)

## V13f — QSY unifié : log + kiwi + indicatif pré-rempli + azimut visible
- [x] Au clic QSY : CAT (freq/mode) + pré-remplir l'indicatif DX dans le RunModeLog (via pinnedSpot)
- [x] Afficher dans le RunModeLog l'azimut du DX cible (calculé depuis les coords du spot) en bleu + azimut antenne en ambre
- [x] L'opérateur voit d'un coup : ANT X°, DX Y°, Δ Z° (vert si <15°, rouge sinon)
- [x] Le rotor reste piloté manuellement (pas de rotation automatique au QSY)

## V14 — Historique de contacts (déjà travaillé ?)
- [x] Procédure tRPC logbook.history(call) : retourne les QSOs précédents (bande, mode, date, RST, pays)
- [x] Afficher dans le RunModeLog l'historique quand un indicatif est saisi (bandes/modes/dates)
- [x] Indicateur visuel : NEW (vert) si jamais contacté, ou DÉJÀ TRAVAILLÉ (orange) avec résumé bandes/modes + date du dernier QSO

## V15 — Réorganisation layout 3 colonnes (Filtres | Spots | Station)
- [x] Déplacer RunModeLog + SelfMonitor + Prévisions DX + Carte + Stats dans colonne droite "Station"
- [x] La colonne centrale ne contient plus que le flux de spots (+ contest mode collapsible)
- [x] Panneau Station sticky (top-[52px], max-h viewport, overflow-y-auto)
- [x] Responsive : sur mobile, panneau Station masqué (hidden lg:flex), spots en plein écran

## V16 — Suppression mode contest + onglets panneau droit
- [x] Supprimer ContestModeCollapsible et toutes les refs contest de Home.tsx
- [x] Supprimer bascule contest du RunModeLog et LogQsoDialog
- [x] Supprimer props contestMode/contestStatus/onMultiClick de SpotRow
- [x] Supprimer le lien /multipliers de la navigation + route App.tsx
- [x] Supprimer contest coloring (MULTI badge, FAIT/HB buttons) de SpotRow
- [x] Supprimer contestBands/contestModes de DxDirections
- [x] Panneau filtres déplacé de la colonne gauche vers onglet droit
- [x] Système d'onglets dans le panneau droit : Filtres | Aide DX | Prévisions
- [x] Onglet Filtres : FilterPanel + TargetPanel
- [x] Onglet Aide DX : RunModeLog + SelfMonitor + Carte
- [x] Onglet Prévisions : DxDirections + Stats bandes + Ouvertures + FT8

## V17 — Refonte visuelle style DXHeat/DXSummit (épuré, lisible, propre)
- [x] Layout 3 colonnes : Filtres (gauche collapsible) | Tableau spots (centre) | Panneau station (droite)
- [x] Filtres en colonne gauche (FilterPanel + TargetPanel, collapsible)
- [x] Tableau propre avec colonnes alignées (UTC, Bande, Fréquence, Mode, DX, Pays, Commentaires, Dist/Az)
- [x] Panneau droit compact : RunModeLog + SelfMonitor + Carte + Prévisions (collapsible)
- [x] Switch thème sombre/clair dans le header (Sun/Moon)
- [x] Thème dual CSS (clair : fond blanc, couleurs vives / sombre : anthracite, accent ambre)
- [x] Variables CSS (bg-background, bg-card, etc.) au lieu de oklch hard-codés
- [x] Suppression bruit visuel : layout épuré, moins de bordures, espacement clair

## V18 — Filtres en overlay Sheet (tiroir latéral droit)
- [x] Supprimer la colonne gauche (filtres)
- [x] Bouton "Filtres" dans la barre sous-header (ouvre un Sheet overlay côté droit, w-320px)
- [x] Sheet contient FilterPanel + TargetPanel + bouton Reset
- [x] showFilters initialisé à false (fermé par défaut, s'ouvre au besoin)
- [x] Layout passé à 2 colonnes : spots pleine largeur + panneau droit Station

## V18b — Supprimer panneau droit, RunModeLog en haut, Sheet "Station"
- [x] Supprimer la colonne droite permanente (aside Station)
- [x] RunModeLog placé en haut du tableau de spots (toujours visible quand radio connectée)
- [x] Bouton "Station" dans la barre sous-header (à côté de "Filtres")
- [x] Sheet "Station" (tiroir droit) contient : SelfMonitor + Carte DX + Prévisions DX
- [x] Layout pleine largeur : spots occupent tout l'espace horizontal

## V18c — SelfMonitor collapsible sous le RunModeLog (pleine largeur)
- [x] Retirer le SelfMonitor du Sheet "Station"
- [x] Placer le SelfMonitor sous le RunModeLog (pleine largeur, collapsible)
- [x] Replié par défaut, bouton "Self-Monitor" pour déplier
- [x] Le Sheet Station ne garde que Carte DX + Prévisions DX

## V18d — RunModeLog toujours visible + bouton Monitor à côté de Station
- [x] RunModeLog toujours visible (même sans CAT connecté, mode dégradé)
- [x] Bouton "Monitor" déplacé dans la barre sous-header (à côté de Station/Filtres)
- [x] Retirer le bouton Monitor de l'intérieur du RunModeLog

## V18e — Bouton Rotor dans la barre sous-header avec popover
- [x] Bouton Rotor dans la barre sous-header (à côté de Monitor) affichant l'azimut actuel
- [x] Popover qui s'ouvre au clic avec champ de saisie des degrés + bouton Go
- [x] Envoi de la commande rotor en direct depuis le popover (Enter ou clic GO)
- [x] Retirer le widget rotor du header principal

## V19 — Logbook : Nouveau QSO + filtre Bandes dynamique
- [x] Descendre le bouton "Nouveau QSO" dans la barre à côté du sélecteur de période
- [x] Ajouter un menu déroulant "Toutes bandes" qui ne liste que les bandes avec des contacts existants
- [x] Filtrage du tableau par bande sélectionnée
- [x] Classement alphabétique (numérique) des bandes dans le menu déroulant

## V20 — Responsive mobile (téléphone)
- [x] Header : compteurs masqués mobile (lg:flex), horloge compacte, indicateurs masqués (sm:flex), langue masquée
- [x] Barre sous-header : compact (px-2, gap-1.5), labels texte masqués mobile (icônes seules), overflow-x-auto
- [x] RunModeLog + SelfMonitor : padding compact mobile (px-2 py-1.5)
- [x] Tableau spots : font plus petit (text-[11px]), colonnes Fréq/Pays masquées mobile (sm:table-cell)
- [x] SpotRow : repli mobile (sm:hidden) avec mode+pays+spotter sous l'indicatif
- [x] Sheets (Station/Filtres) : largeur 85vw sur mobile pour meilleure lisibilité
- [x] Logbook header : boutons compacts, compteur QSO toujours visible, DXCC masqué mobile
- [x] Logbook filtres : gap réduit, champ recherche plus étroit (w-32)

## V20b — Indicateur fréquence + rotor lecture seule dans le header
- [x] Affichage lecture seule après la nav : fréquence (MHz) + azimut rotor (°)
- [x] Pas d'interaction, juste l'info en temps réel
- [x] Masqué sur mobile (sm:flex), visible dès tablette

## V20c — Mode affiché + clignotement + indicateur mobile
- [x] Mode (SSB/CW/etc.) affiché en ambre à côté de la fréquence
- [x] Clignotement bref (scale+brightness 600ms) quand fréquence ou rotor change
- [x] Indicateur fréquence+mode+rotor dans le menu hamburger mobile

## V21 — Panneau Flex Control + Push Spots Panadapter + Antenna Genius
- [x] Hook useFlexControl : extension relay HTTP pour commandes Flex avancées (power, tune, mox, dsp, ant)
- [x] Composant FlexControlPanel : slider Power, boutons TUNE/MOX, toggles NB/NR/ANF, sélecteur antenne RX/TX, télémétrie (S-mètre, puissance, ROS, ALC, temp PA)
- [x] Hook useAntennaGenius : connexion relay HTTP vers bridge pour Antenna Genius (port 9007 GSCP)
- [x] Composant AntennaGeniusWidget : affichage antenne active + boutons commutation + auto-band toggle
- [x] Toggle "Push to Pan" : envoie les spots filtrés sur le panadapter SmartSDR via le bridge
- [x] Intégration dans la barre sous-header : boutons Flex + Ant (Sheets overlay)
- [x] Router antennaRelay.ts + extension catRelay.ts avec champs Flex control
- [x] Protocole relay HTTP documenté (commandes JSON : setpower, tune, mox, dsp, setant, spot, clearspots)

## V22 — Filtrage RX automatique + Égaliseur + RF Gain adaptatif
- [x] Étendre catRelay.ts : champs filterLo, filterHi, rfGain, apfEnabled, eqBands (8 bandes), rxPreset
- [x] Nouvelles commandes bridge : setfilter, setrfgain, seteq, setpreset, apf
- [x] Hook useRxDsp : gère l'état filtres/EQ/RFGain + envoi commandes + mode auto
- [x] 8 presets de filtrage adaptatifs (DX Ouvert, DX Pile-up, DX Faible, QRM Sévère, CW Confort, CW Contest, SSB Étroit, Digital Large)
- [x] 8 presets d'égaliseur RX (Plat, Voix naturelle, DX lointain, Anti-splash, CW Pic, Coupe basses, Présence, Contest)
- [x] RF Gain adaptatif (-8 à +32 dB) selon le S-mètre (computeAdaptiveRfGain)
- [x] Composant RxFilterPanel : sélection preset + barre visuelle filtre + sliders lo/hi + EQ graphique 8 bandes + RF Gain
- [x] Mode automatique intelligent : bascule preset + EQ + RF Gain selon S-mètre et mode (throttle 5s)
- [x] Intégration dans le Sheet "Flex" (sous le FlexControlPanel, avec wrapper smeter)

## V22b — Bridge étendu + Presets personnalisés
- [x] Script bridge-relay-v7.mjs : connexion TCP SmartSDR (port 4992) + polling état + exécution commandes
- [x] Bridge : commandes Flex (setfilter → slice set filter_lo/filter_hi, setrfgain, seteq, setpreset, apf, setpower, tune, mox, dsp, setant)
- [x] Bridge : télémétrie VITA-49 (smeter, fwdPower, swr, alc, paTemp) relayée au serveur
- [x] Bridge : push spots sur panadapter (spot add rx_freq callsign color)
- [x] Bridge : connexion TCP Antenna Genius (port 9007, protocole GSCP) + commutation antennes
- [x] Bridge : connexion rotor (ARCORE via série/TCP)
- [x] Presets personnalisés : bouton "Sauver" dans RxFilterPanel pour créer un preset custom (filtre + EQ)
- [x] Presets personnalisés : stockage localStorage + affichage dans la grille de presets (étoile ambre)
- [x] Presets personnalisés : suppression d'un preset custom (bouton × au survol)

## V22c — Bridge réécrit pour protocole Kenwood CAT (SmartLink compatible)
- [x] Découverte critique : SmartLink ne permet pas l'accès TCP 4992 (API native Flex)
- [x] SmartSDR for Mac v2.9.132 expose un port CAT Kenwood sur 5001 (localhost)
- [x] Réécriture complète bridge-relay-v7.mjs pour protocole Kenwood CAT
- [x] Connexion TCP port 5001 au lieu de 4992
- [x] Lecture fréquence/mode via IF; et FA; (Kenwood standard)
- [x] Lecture S-mètre via SM0; + conversion échelle 0-260 → dBm
- [x] Lecture puissance/SWR/ALC via RM1;/RM3;/RM5;
- [x] Commande QSY via FA (11 digits Hz) + MD (mode code)
- [x] Commande Power via PC (3 digits)
- [x] Commande TUNE via AC111;/AC110;
- [x] Commande MOX via TX;/RX;
- [x] Commandes DSP : NB, NR (NB1;/NR1;), ANF via NT (NT1;)
- [x] Commande filtre via SL/SH (Hz directs)
- [x] Commande RF Gain via AG0 (mapping -8/+32 dB → 0-255)
- [x] Polling cyclique 500ms (IF, SM, PC, RM1, RM3, RM5 en rotation)
- [x] Gestion gracieuse des fonctions non disponibles (APF, EQ, spots pan, ant RX/TX)
- [x] start-bridge-v7.sh mis à jour (CAT_HOST=127.0.0.1, CAT_PORT=5001, AG_ENABLED=false)
- [x] GUIDE-TEST-V7.md réécrit pour v7.1 (architecture SmartLink, commandes Kenwood, dépannage)

## V23 — Filtre géographique des spotters (pertinence locale)
- [x] Filtrer les spots pour ne garder que ceux provenant de spotters européens et pays proches
- [x] Exclure les spots de spotters US, asiatiques lointains, océaniens (non pertinents pour F4IVV/JN25PG)
- [x] Un W qui spot un VK sur 40m à 16h n'est pas pertinent → filtré
- [x] Zones de spotters acceptées : Europe (EU), Afrique du Nord, Moyen-Orient proche
- [x] Spothole : paramètre de_continent=EU,AF ajouté à l'URL API
- [x] DX Summit : filtre par coordonnées spotter (lat 25-72°N, lon -30°W à 60°E)
- [x] Vérifié : 200 spots → 185 EU + 4 AF + 11 unknown, 0 NA/AS/OC

## V24 — Bridge v8.0 API native FlexRadio (port 4992, connexion directe)
- [x] Réécriture complète bridge-relay-v8.mjs pour API native Flex (port 4992)
- [x] Connexion TCP directe au FlexRadio (pas via SmartSDR Kenwood CAT)
- [x] Protocole natif : C<seq>|<cmd> pour envoi, R/S/V/H/M pour réception
- [x] QSY via `slice t <id> <freq>` + `slice s <id> mode=<mode>`
- [x] Split via XIT : `slice s <id> xit_on=1 xit_freq=<offset>`
- [x] Power via `transmit set rfpower=<val>`
- [x] TUNE via `transmit tune on/off`
- [x] MOX via `xmit 1/0`
- [x] DSP (NB/NR/ANF/APF) via `slice s <id> nb=1/nr=1/anf=1/apf=1`
- [x] Filtre via `filt <id> <lo> <hi>`
- [x] RF Gain via `slice s <id> rf_gain=<dB>`
- [x] EQ RX 8 bandes via `eq rxsc <band> level=<dB>`
- [x] Sélection antenne via `slice s <id> rxant=<ant>/txant=<ant>`
- [x] Spots panadapter via `spot add rx_freq=... callsign=... color=...`
- [x] Clear spots via `spot remove <idx>`
- [x] Souscription meters (sub meter) pour télémétrie native
- [x] Souscription slice/transmit/radio/spot status
- [x] Keepalive ping toutes les 4s (connexion stable)
- [x] Reconnexion automatique en cas de déconnexion
- [x] start-bridge-v8.sh créé
- [x] GUIDE-TEST-V8.md rédigé (comparaison v7.1/v8.0, installation, config, dépannage)
- [x] Fichiers uploadés pour téléchargement direct

## V24b — Fix bridge v7.2 (port 5001 stable) + port 4992 inaccessible
- [x] Découvert que port 4992 est bloqué quand SmartSDR est connecté (ETIMEDOUT)
- [x] Bridge v7.2 : désactivé socket timeout (cause des déconnexions)
- [x] Bridge v7.2 : keepalive custom (IF; toutes les 3s si pas de data)
- [x] Bridge v7.2 : reconnexion si pas de réponse keepalive en 10s
- [x] Bridge v7.2 : TCP keepalive réduit à 5s
- [x] Bridge v7.2 : mode VERBOSE pour debug (VERBOSE=true)
- [x] Bridge v7.2 : Antenna Genius désactivé par défaut (AG_ENABLED=false)
- [x] Bridge v7.2 : supprimé \r\n après les commandes CAT (juste le cmd brut)
- [x] Upload v7.2 pour téléchargement

## V25 — Mode SO2R (Dual Radio : Flex 6401 + Flex 8600)
- [x] Architecture SO2R : bridge dual-radio, interlock TX, état RUN/MULTI (SO2R-ARCHITECTURE.md)
- [x] Bridge SO2R : connexion simultanée à 2 ports CAT (5001 + 5002) — bridge-so2r.mjs
- [x] Bridge SO2R : interlock TX logiciel (un seul poste émet à la fois)
- [x] Bridge SO2R : push état dual vers serveur (radioA + radioB + roles)
- [x] Backend : router tRPC SO2R (état dual, commande SWAP, QSY ciblé) — catRelay.ts
- [x] Backend : commandes swap, qsy_multi, qsy_run, swap_and_qsy
- [x] Backend : QSY cluster → toujours vers poste MULTI quand SO2R actif
- [x] Interface : panneau SO2R avec 2 colonnes RUN (vert) / MULTI (bleu) — So2rPanel.tsx
- [x] Interface : bouton SWAP visuel + raccourci Ctrl+Tab
- [x] Interface : indicateur TX clair (ring rouge, badge TX)
- [x] Interface : clic spot → QSY automatique vers MULTI (Home.tsx + SpotDetail.tsx)
- [x] Interface : bouton SWAP+QSY dans SpotDetail (QSY MULTI + SWAP immédiat)
- [x] Start script : start-bridge-so2r.sh (config env + lancement)
- [x] Préparation pédale USB : annulée avec le retrait du mode SO2R lors de la simplification V31
- [x] Préparation DXLog SO2R : annulée avec le retrait du mode SO2R lors de la simplification V31
- [x] Routage audio multi-radio : annulé avec le retrait du mode SO2R et des filtres audio lors de V31c

## V25b — Bridge SO2V (Single Flex, Dual Slice sur un seul port CAT)
- [x] Bridge SO2V : connexion unique port 5001, commandes FA/FB pour Slice A/B
- [x] Bridge SO2V : interlock TX logiciel (seul le slice RUN émet)
- [x] Bridge SO2V : push état dual vers serveur (compatible avec panneau SO2R existant)
- [x] Bridge SO2V : SWAP rôles RUN/MULTI entre slices
- [x] Bridge SO2V : QSY cluster → slice MULTI via FB (ou FA si MULTI=A)
- [x] Bridge SO2V : swap_and_qsy (QSY MULTI + SWAP)
- [x] Bridge SO2V : détection mode depuis fréquence pour Slice B
- [x] Start script : start-bridge-so2v.sh
- [x] Fichiers uploadés pour téléchargement

## V25c — Panneau SO2R compact dans la vue cluster principale
- [x] Composant So2rBar compact : RUN freq | SWAP ⇄ | MULTI freq — toujours visible
- [x] Intégrer So2rBar dans Home.tsx (sous-header, entre titre Cluster et boutons droite)
- [x] Masquer automatiquement si SO2R non actif (retourne null si !data.so2r)

## V25d — SWAP commute le TX réel (FT0/FT1)
- [x] Bridge SO2V v1.1 : SWAP envoie FT0; ou FT1; pour basculer le TX vers le nouveau RUN
- [x] Bridge SO2V v1.1 : polling FT; pour détecter quel slice a le TX
- [x] Bridge SO2V v1.1 : si TX change sur le poste → met à jour les rôles RUN/MULTI automatiquement
- [x] Backend : déjà fonctionnel (swap via pendingCommands, bridge gère FT0/FT1)
- [x] Bridge SO2V v1.1 : ajout handler setfilter (SL/SH) pour filtres à distance
- [x] Bridge SO2V v1.1 : ajout handler setpreset (presets DX Ouvert, Faible, Pile-up, QRM, CW)

## V26 — Corrections bridge + Filtres/EQ dans barre SO2R + Spots sur pan + MUTE
- [x] Interface : inverser affichage (MULTI bleu à gauche = oreille gauche, RUN vert à droite = oreille droite)
- [x] Interface : bouton MUTE sur MULTI et sur RUN dans la barre SO2R
- [x] Bridge : commande MUTE (AG0 pour couper volume slice, AG restore pour rétablir)
- [x] Bridge : corriger TUNE (TX + auto-stop 10s)
- [x] Bridge : corriger DSP toggles (NB/NR/ANF)
- [x] Bridge : commutateur d'antenne (commande AN)
- [x] Bridge : télémétrie (S-mètre SM, volume, muted, antenne dans payload push)
- [x] Interface : bouton Filtre dans la barre SO2R (à droite du RUN)
- [x] Interface : menu déroulant avec 8 presets filtre (SSB/DX + CW/DIGI en 2 colonnes)
- [x] Interface : presets personnalisés annulés avec la suppression du Filtre Audio/DSP lors de V31c
- [x] Bridge : envoyer spots cluster vers panadapteur SmartSDR (commande spot) — implémenté V27 via API native

## V26b — Fix commandes perdues (serverless memory issue)
- [x] Bug : commandes en mémoire volatile perdues entre instances serverless (Autoscale)
- [x] Solution : stocker pendingCommands en base de données au lieu de la mémoire
- [x] Vérifier que toutes les commandes (MUTE, TUNE, DSP, ANT, SWAP, QSY) passent de manière fiable

## V27 — Bridge SO2V hybride v1.3 (CAT + API native pour spots panadapteur)
- [x] Bridge : ajouter connexion parallèle TCP 4992 (API native FlexRadio) pour spots
- [x] Bridge : client bind au GUI SmartSDR pour autoriser les spots
- [x] Bridge : handler spot add / spot remove via API native
- [x] Bridge : handler clearspots via API native
- [x] Bridge : nouvelle env var FLEX_IP + FLEX_PORT pour la connexion native
- [x] Bridge : mode hybride optionnel (SPOTS_ENABLED=false pour désactiver)

## V27b — Fix commandes + Filtre Audio
- [x] Bug : MUTE ne passait pas car AG non supporté par SmartSDR CAT — basculé sur API native (slice set audio_mute)
- [x] Interface : renommer "Filtre" → "Filtre Audio" dans la barre SO2R
- [x] Interface : menu déroulant Filtre Audio style panneau (comme le bouton Flex)

## V28 — Nettoyage complet (WAN only)
- [x] Supprimer le panneau "Contrôle Flex Radio" (FlexControlPanel)
- [x] Supprimer les boutons MUTE de la barre SO2R
- [x] Ajouter EQ on/off dans le menu Filtre Audio
- [x] Ajouter NB/NR/ANF toggles dans le menu Filtre Audio
- [x] Supprimer la connexion native port 4992 du bridge (éviter spam erreurs)
- [x] Supprimer les handlers mute/spots/antenne du bridge
- [x] Nettoyer les routes/navigation liées au panneau Flex + composants orphelins (useFlexControl, PushToPanToggle, So2rPanel)

## V28b — Fix Filtre Audio : popover par-dessus (pas sous la barre)
- [x] Transformer le menu Filtre Audio en Popover qui s'ouvre par-dessus le contenu (z-index élevé)
- [x] Le popover disparaît quand on clique ailleurs (comme le rotor)

## V28d — Mise à jour références bridge v2.0 dans l'interface
- [x] NavBar : commande de lancement mise à jour (cd ~/dxhunter-bridge-so2r && ./start-bridge-so2v.sh)
- [x] NavBar : lien de téléchargement mis à jour (bridge-so2v_ab98461b.mjs)
- [x] SpotDetail : messages d'erreur mis à jour avec la nouvelle commande bridge v2.0

## V29 — Bridge mode single-slice (1 seul panadapteur)
- [x] Bridge : fonctionner avec un seul slice (FA uniquement, pas de FB)
- [x] Bridge : push so2r=false quand 1 seul slice, so2r=true quand 2 slices
- [x] Bridge : QSY/filtre/DSP/puissance fonctionnent en mode single-slice
- [x] Serveur : cat.state retourne radioConnected=true même sans SO2R
- [x] Frontend : afficher indicateur fréquence + bouton Filtre Audio même sans SO2R (pas de barre SO2R)
- [x] Frontend : QSY depuis les spots fonctionne en mode single-slice

## V30 — Deux scripts bridge (Simple 1 VFO + SO2V 2 VFO)
- [x] Créer bridge-simple.mjs basé sur v7 (1 VFO, IF; polling, compatible 1 pan)
- [x] Créer start-bridge-simple.sh
- [x] Mettre à jour l'UI NavBar avec les deux options de bridge (commandes à copier-coller)

## V31 — Simplification radicale

- [x] Restaurer bridge v7 comme unique bridge (un seul script, fiable)
- [x] Supprimer Logbook/DXCC de la navigation et des routes
- [x] Supprimer le widget Rotor de l'interface
- [x] Nettoyer la navigation (garder : Cluster, Propagation, Azimut, Auto-spot, QSY, Filtre Audio)
- [x] Mettre à jour le popover Bridge avec le script v7 uniquement
- [x] Mettre à jour les messages d'erreur CAT (SpotDetail) vers bridge v7
- [x] Supprimer les boutons Rotor de DxDirections (garder l'affichage azimut)

## V31b — Nettoyage interface (suppression Station/AntennaGenius/Manus)

- [x] Supprimer le panneau Station (panneau droit avec showStation)
- [x] Supprimer le bouton et Sheet Antenna Genius
- [x] Supprimer le bouton WhatsApp (WhatsAppButton)
- [x] Garder Filtre Audio (So2rBar) sur la page Cluster
- [x] Garder le Moniteur (SelfMonitor) sur la page Cluster — toujours visible
- [x] RunModeLog reste sous le RUN sur la même page
- [x] Supprimer liens Logbook et DXCC de la navigation (desktop + mobile)

## V31c — Retrait filtres/DSP + remise Rotor

- [x] Supprimer le So2rBar (filtre audio/DSP) — les filtres bande/mode restent
- [x] Remettre le widget Rotor sur la page Cluster

## V31d — Bouton rotor sur chaque spot

- [x] Ajouter un petit bouton rotor (icône navigation) sur chaque ligne de spot pour pointer l'antenne vers le DX

## V31e — Réorganisation header + suppression RunModeLog

- [x] Supprimer le RunModeLog (mini-logbook)
- [x] Remonter RotorWidget dans le header entre Infos DX et indicateur fréquence
- [x] Déplacer Pilotage, Prévisions, Infos DX sur la même ligne que le Plan 24h

## V31f — Filtres à côté du titre + Rotor admin-only + Prévisions propagation

- [x] Déplacer le bouton Filtres à côté du titre "Cluster DX (count)"
- [x] Sécuriser le rotor (widget + API) pour admin uniquement
- [x] Améliorer l'acquisition de données FT8 pour les prévisions de propagation — 4 captures/h, créneaux distincts et fermetures enregistrées
- [x] Affiner le modèle de prévision propagation — fusion NOAA+FT8, SNR corrigé et confiance pondérée ; objectif 65-70% à valider sur le nouvel historique
- [x] Supprimer l'ouverture automatique du LogQsoDialog lors d'un QSY
- [x] Bug: QSY pin force la fréquence en boucle — CORRIGÉ : déduplication des commandes dans bridge-relay-v7.mjs (processedCmdIds)

## V32 — Écoute DX administrateur

- [x] Auditer et réutiliser les fonctions CAT, rotor, QRZ, spots historiques et KiwiSDR existantes
- [x] Définir un contrat serveur admin-only pour figer fréquence, mode, azimut et trajet au lancement de la recherche
- [x] Rechercher les spots candidats des 6 dernières heures avec tolérance ±2,5 kHz SSB, ±500 Hz CW et ±100 Hz numérique
- [x] Classer les indicatifs candidats par heure, spotter et pays sans choisir arbitrairement une station
- [x] Enrichir un indicatif via QRZ en priorité avec opérateur, pays, locator, distance et azimut
- [x] Classer les KiwiSDR dans un corridor de ±30° selon alignement, disponibilité et pertinence géographique
- [x] Ajouter le basculement Short Path / Long Path et l’ouverture d’un KiwiSDR préréglé sur fréquence et mode
- [x] Intégrer l’écoute KiwiSDR dans la page lorsqu’elle est techniquement autorisée, avec repli vers l’ouverture externe
- [x] Créer la page admin-only « Écoute DX » avec fréquence CAT et azimut rotor ou saisie manuelle
- [x] Ajouter un encart « Écoute DX » distinct dans l’en-tête, près du logo Daruma, du rotor et de la fréquence
- [x] Surveiller les nouveaux spots compatibles après le lancement et produire une alerte visuelle et sonore
- [x] Protéger la route frontend et toutes les procédures serveur pour le rôle administrateur
- [x] Écrire les tests Vitest du classement, des tolérances, du corridor et du contrôle d’accès
- [x] Vérifier l’interface sur ordinateur et mobile puis publier V32 — build responsive validé, garde public contrôlé ; vue admin à confirmer dans la session propriétaire

## V32b — Rétablissement CAT et QSY

- [x] Diagnostiquer pourquoi le bridge v7 ne se reconnecte plus depuis le terminal
- [x] Vérifier que le téléchargement du bridge fournit bien le script v7 exécutable et la bonne URL serveur — asset servi obsolète et installation non synchronisée
- [x] Vérifier la détection CAT et la remontée de fréquence depuis SmartSDR sur le port 5001 — contrat validé ; connexion matérielle à confirmer sur le Mac
- [x] Rétablir l’affichage du bouton QSY sans dépendre d’un ancien mode SO2R, y compris sur mobile
- [x] Garantir que QSY reste one-shot tout en conservant le dernier spot sélectionné en haut de liste
- [x] Ajouter ou mettre à jour les tests Vitest du CAT, de la visibilité QSY et de la déduplication — 324 tests passent
- [x] Publier le correctif et fournir une procédure terminal unique pour Mac

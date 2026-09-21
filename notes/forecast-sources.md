# Sources de données pour prévision 7 jours propagation 40 m

## Space Weather Live (https://www.spaceweatherlive.com/fr.html)
Données observées le 05/07/2026 :
- SFI observé : 161 (en baisse de 26)
- Taches solaires : 97
- Prévisions Kp : dim 2-5, lun 2-4, mar 1-2
- Dernière X : X1.3 (04/07), dernière M : M1.0 (05/07)
- Dernier orage : G3 Kp7+ (04/07)
- Probabilités éruptions : C 99%, M 75%, X 20%
- Régions actives : AR4478 (24 taches, FKO), AR4479 (17, FKC), AR4480 (4, DAO)
- Vent solaire : ~502 km/s

## Sources NOAA déjà intégrées dans DX Hunter

### spots.solar (via HamQSL/NOAA)
- SFI, A, K, X-ray, proton_flux, electron_flux, sunspots, solar_wind
- HF conditions par bande (jour/nuit)
- Mis à jour en temps réel

### spots.spaceWeather (via NOAA SWPC direct)
- Kp temps réel (mesure 3h)
- A-index
- SFI prévision
- Dernière éruption (classe + heure)
- Blackout (R0-R5)
- Outlook 7 jours (date, sfi prévu, a prévu, kp prévu)

## Sources NOAA supplémentaires à exploiter pour prévision 7 jours

### Prévision SFI 27 jours
- URL : https://services.swpc.noaa.gov/text/27-day-outlook.txt
- Contient : SFI prévu, A prévu, Kp prévu jour par jour sur 27 jours

### Prévision Kp 3 jours (NOAA)
- URL : https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json
- Contient : Kp prévu par créneau de 3h sur 3 jours

### Probabilités d'éruptions (NOAA)
- URL : https://services.swpc.noaa.gov/text/3-day-forecast.txt
- Contient : probabilités C/M/X par jour sur 3 jours

### Prévision géomagnétique 3 jours
- URL : https://services.swpc.noaa.gov/text/3-day-geomag-forecast.txt

## Plan d'implémentation
1. Récupérer le 27-day-outlook NOAA (SFI + Kp + A sur 7 jours)
2. Récupérer les probabilités d'éruptions 3 jours
3. Croiser avec notre outlook existant (déjà dans spaceWeather)
4. Calculer un score de propagation 40 m prévu par jour et par zone
5. Afficher dans un nouvel onglet "Prévision 7 j" sur la page Pilotage
6. Indiquer les jours favorables/défavorables avec un code couleur

# Recherche : Filtres DX Summit + Propagation Sporadique

## DX Summit — Interface de filtrage

### Structure des filtres (Include / Exclude)
- **Mode** : PHONE, CW, DIGI
- **HF** : HF (tout), 1.8MHz, 3.5MHz, 5MHz, 7MHz, 10MHz, 14MHz, 18MHz, 21MHz, 24MHz, 28MHz, WARC
- **VUSHF** : VHF (tout), UHF, SHF, 50MHz, 70MHz, 144MHz, 220MHz, 430MHz, 1.2GHz, 2.3GHz, 3.4GHz, 5.6GHz, 10GHz, 24GHz, 47GHz
- **LF** : LF (tout), 137kHz, 472kHz
- **Flags** : iota, satellite, qrp, mobile, portable, beacon (On/Off pour chaque)
- Deux sections : "Include selections" et "Exclude selections"
- Boutons "Set filters" et "Clear filters"

### Fonctionnement
- On peut inclure OU exclure des bandes/modes spécifiques
- Les flags permettent de filtrer par type d'opération spéciale

---

## Propagation Sporadique (Es / Sporadic E)

### Caractéristiques
- Réflexion sur des patches d'ionisation dans la couche E (95-120 km d'altitude)
- **Imprévisible** mais avec des patterns saisonniers (pic en juin-juillet dans l'hémisphère nord)
- Distances typiques : 800-2200 km (single hop)
- MUF variable : 25-150 MHz (parfois jusqu'à 225 MHz)
- Bandes affectées : principalement **6m (50 MHz)**, 10m (28 MHz), 2m (144 MHz), 4m (70 MHz)
- Aussi 28 MHz (10m) et parfois 21 MHz (15m) en HF
- Durée : quelques minutes à quelques heures

### Saison
- Pic principal : mi-mai à début août (hémisphère nord)
- Pic secondaire : solstice d'hiver (décembre-janvier)
- Plus fréquent autour du solstice d'été

### Types de Sporadic E
- **Mid-latitude Es** : le plus courant, pic estival
- **Equatorial Es** : régulier en journée dans les régions équatoriales
- **Auroral Es** : associé aux aurores, haute latitude

---

## Autres modes de propagation "aléatoires"

### TEP (Trans-Equatorial Propagation)
- Propagation trans-équatoriale
- Signaux traversent l'équateur magnétique
- Fréquences : 50-144 MHz
- Pic : équinoxes (mars, septembre-octobre)
- Distances : 4000-8000 km
- Heures : fin d'après-midi, début de soirée

### FAI (Field-Aligned Irregularities)
- Réflexion sur des irrégularités alignées avec le champ magnétique terrestre
- Fréquences : 50-144 MHz
- Distances : 500-2000 km
- Signaux faibles, souvent CW/FT8

### Meteor Scatter (MS)
- Réflexion sur les traînées ionisées des météores
- Fréquences : 50-144 MHz (surtout 6m et 2m)
- Durée : quelques secondes à 1 minute par burst
- Modes : FT8, MSK144, WSJT-X
- Pics : pluies de météores (Perséides août, Géminides décembre)

### Tropospheric Ducting (Tropo)
- Propagation dans des conduits troposphériques
- Fréquences : VHF/UHF
- Distances : 500-2000+ km
- Lié à la météo (fronts froids, inversions de température)

### Aurora
- Réflexion sur les aurores boréales/australes
- Fréquences : 50-144 MHz
- Signal caractéristique : tonalité "buzz" (CW) ou distorsion
- Lié à l'activité géomagnétique (Kp élevé)

---

## Mots-clés dans les commentaires de spots (détection)

### Sporadic E
- "Es", "SpE", "Sporadic", "Sporadic E", "Spo E"
- "Es opening", "Es cloud"
- Fréquences 50 MHz, 70 MHz, 144 MHz avec contacts inhabituels

### TEP
- "TEP", "Trans-Equatorial", "TransEq"

### Meteor Scatter
- "MS", "Meteor", "MSK144", "meteor scatter"
- Modes WSJT-X spécifiques

### Tropospheric
- "Tropo", "Duct", "Ducting", "Tropospheric"

### Aurora
- "Aurora", "Au", "Auroral"

### Détection automatique (heuristiques)
1. **Bande 50 MHz (6m)** : tout spot sur 50 MHz avec distance > 500 km = probable Es
2. **Bande 144 MHz (2m)** : tout spot avec distance > 300 km = propagation anormale
3. **28 MHz (10m)** : spots avec commentaire mentionnant "Es" ou contacts inhabituels été
4. **Commentaires** : scan des mots-clés ci-dessus
5. **Densité de spots** : augmentation soudaine de spots sur 50/144 MHz = ouverture Es probable
6. **Combinaison** : fréquence VHF + distance inhabituelle + saison = alerte sporadique

### DXMaps approach
- DXMaps détecte les ouvertures Es en temps réel via les spots DX cluster + PSK Reporter
- Envoie des alertes email personnalisées par bande (50/144/432/1296 MHz)
- Distingue les modes de propagation : Es, Tropo, TEP, MS, Aurora, EME
- Utilise la distance entre spotter et DX + la fréquence pour classifier

### Mots-clés de commentaires à scanner (regex patterns)
- Es/Sporadic : `\b(Es|SpE|spora?dic|spor[- ]?e)\b`
- TEP : `\b(TEP|trans[- ]?eq|trans[- ]?equat)\b`
- Meteor : `\b(MS|meteor|MSK144|FSK441)\b`
- Tropo : `\b(tropo|duct|ducting)\b`
- Aurora : `\b(aurora|auroral|\bAu\b)\b`
- F2 : `\b(F2|f2[- ]?layer|long[- ]?path)\b`
- Backscatter : `\b(backscatter|BS|back[- ]?scatter)\b`

### Bandes VHF/UHF à surveiller pour propagation anormale
- 50 MHz (6m) : la "Magic Band" - Es le plus fréquent
- 70 MHz (4m) : Es fréquent en Europe
- 144 MHz (2m) : Es rare mais spectaculaire, tropo, MS
- 430 MHz (70cm) : tropo uniquement
- 1296 MHz (23cm) : tropo, EME

---

## Conception pour DX Hunter

### Filtres avancés (style DX Summit)
- Panneau dépliant avec Include/Exclude
- Modes : PHONE (SSB/AM/FM), CW, DIGI (FT8/FT4/RTTY/PSK)
- Bandes HF : 160m, 80m, 40m, 20m, 15m, 10m, WARC (30m/17m/12m)
- Bandes VHF+ : 6m (50MHz), 4m (70MHz), 2m (144MHz), 70cm (430MHz)
- Flags : IOTA, Satellite, QRP, Mobile, Portable, Beacon, DXpedition

### Détecteur de propagation sporadique
- Analyse en temps réel des spots sur 50/144/70 MHz
- Détection par mots-clés dans les commentaires
- Détection par densité (burst de spots VHF)
- Alerte visuelle : badge clignotant "SPORADIC E" sur la bande concernée
- Alerte sonore : son spécifique pour ouverture sporadique
- Panneau dédié : direction de l'ouverture, stations entendues, durée estimée

# Météo spatiale & propagation 40 m — base d'expertise pour TM0HQ

Document de référence interne (synthèse de sources NOAA SWPC, HamQSL/N0NBH, QSL.net/4X4XM).
Objectif : interpréter les indices solaires et géomagnétiques pour piloter le 40 m SSB depuis JN25PG.

## 1. Les trois familles d'indicateurs

| Indicateur | Ce qu'il mesure | Cadence | Source temps réel |
| --- | --- | --- | --- |
| **SFI / F10.7** | Flux radio solaire à 10,7 cm (2800 MHz), proxy de l'ionisation | Quotidien (+ 27 j prévision) | NOAA `f107_cm_flux.json`, `27-day-outlook.txt` |
| **SSN** | Nombre de taches solaires | Quotidien | HamQSL |
| **Kp / K** | Perturbation géomagnétique (échelle log 0-9, pas de 3 h) | 1 min (estimé) / 3 h | NOAA `planetary_k_index_1m.json` |
| **A** | Activité géomagnétique sur 24 h (échelle linéaire 0-400) | Quotidien | NOAA 27-day |
| **Éruptions X-ray** | Classe A/B/C/M/X (black-out R0-R5) | Continu (GOES) | NOAA `xray-flares-latest.json` |

## 2. SFI et 40 m : un effet indirect mais réel

Le SFI pilote surtout les bandes hautes (20 m et au-dessus). **Sur 40 m son influence est secondaire** : la bande fonctionne de toute façon la nuit par la couche F2. Toutefois :

- **SFI élevé (>120-150)** : ionisation F2 plus dense → MUF nocturne plus haute, **40 m porte plus loin et plus longtemps après le coucher**, ouvertures DX transéquatoriales et long path plus franches.
- **SFI bas (<80)** : 40 m reste bon la nuit mais les ouvertures lointaines sont plus courtes et plus tardives.

Échelle de lecture (SSN/SFI → conditions) :

| Conditions | BAD | Faible | Moyen | Bon | Excellent |
| --- | --- | --- | --- | --- | --- |
| SFI (sfu) | 67 | 83-102 | 124-148 | 172-196 | 219-273 |

**Pour le 40 m, retenir : SFI = bonus de portée nocturne, pas un prérequis.**

## 3. Kp / A : le facteur DÉCISIF sur 40 m

Le géomagnétisme est le paramètre le plus important sur les bandes basses, **surtout pour les trajets passant par les hautes latitudes** (chemins nord, polaires, transpolaires).

| Kp | A équiv. | État | Effet 40 m depuis JN25 |
| --- | --- | --- | --- |
| 0-2 | 0-7 | Calme | **Idéal.** Tous les caps ouverts, y compris nord/polaire. Bruit bas, signaux stables. |
| 3 | 15 | Instable | Léger affaiblissement des chemins nord/scandinaves. Reste exploitable. |
| 4 | 27 | Actif | Chemins polaires/nord dégradés (flutter, QSB). Privilégier sud/est/ouest bas. |
| 5 | 48 | Tempête mineure (G1) | **Chemins nord fermés/très dégradés.** Auroral flutter sur EU-Nord, Scandinavie, Russie nord. Favoriser trajets bas en latitude (sud, transéquatorial). |
| 6-7 | 80-132 | Tempête modérée/forte (G2-G3) | Absorption auroral importante, bandes basses bruitées. 40 m peut rester ouvert vers le sud mais le DX nord est perdu. |
| 8-9 | 207-400 | Tempête sévère (G4-G5) | Conditions très dégradées sur tous les chemins de latitude moyenne/haute. |

**Règle de pilotage** : plus un cap traverse de hautes latitudes (nord, transpolaire vers JA/USA-Nord/Asie centrale), plus il est sensible au Kp. Les trajets **sud et transéquatoriaux** (Afrique, Amérique du Sud, et long path par le sud) sont les plus robustes en tempête géomagnétique.

## 4. Éruptions solaires (flares) : black-out radio diurne

Une éruption émet un flash de rayons X qui **ionise la couche D du côté éclairé** de la Terre en quelques minutes. La couche D absorbe alors le HF (3-30 MHz) : c'est le **black-out radio (radio fadeout)**.

| Classe | Flux (W/m²) | Black-out NOAA | Effet HF côté jour |
| --- | --- | --- | --- |
| A, B, C | < 1e-5 | R0 | Négligeable |
| **M1-M4** | 1e-5 | R1 (mineur) | Dégradation faible du HF côté soleil, pertes brèves |
| **M5-M9** | 5e-5 | R2 (modéré) | Coupure HF limitée côté jour ~10 min à 1 h |
| **X1-X9** | 1e-4 | R3 (fort) | Black-out HF large côté jour ~1 h |
| **X10+** | 1e-3 | R4-R5 | Black-out étendu, plusieurs heures |

Points clés pour 40 m :
- Le black-out frappe **uniquement la face éclairée** et **surtout les fréquences basses**. 40 m y est sensible **de jour**.
- **La nuit (cœur de l'activité 40 m), un flare n'a pas d'effet direct** : la couche D est absente côté nuit.
- Effet **soudain et bref** (le flash X dure minutes-heures), à distinguer des tempêtes géomagnétiques (Kp) qui durent des heures-jours et arrivent 1-3 jours après l'éruption (via la CME/le vent solaire).
- **Tempête de protons** (après gros flare/CME) : ionise la D aux pôles → **absorption de calotte polaire (PCA)**, ferme les chemins transpolaires même de nuit.

## 5. Chaîne causale à mémoriser

1. **Éruption X-ray** → black-out D côté jour, immédiat, bref. Surveiller `flareClass`/`blackout`.
2. **CME / vent solaire rapide** → 1-3 jours plus tard → **hausse du Kp/A** → tempête géomagnétique → dégradation des chemins nord/polaires (effet long).
3. **SFI** → toile de fond lente : niveau d'ionisation F2, portée nocturne.

## 6. Traduction en décisions de trafic 40 m (JN25 → monde)

- **Kp ≤ 2, pas de flare** : feu vert total. Exploiter les caps nord (Scandinavie, Russie, JA short path matin, USA-Nord). Grayline pleinement efficace.
- **Kp 3-4** : garder le run vers EU/zones denses ; pour les mults, éviter les caps strictement nord, viser est/ouest à latitude moyenne et sud.
- **Kp ≥ 5** : basculer la chasse vers le **sud et le transéquatorial** (Afrique, Amérique du Sud), long path par le sud ; prévenir l'écouteur WebSDR que JA/Asie centrale nord seront faibles.
- **Flare M/X en cours, de jour** : s'attendre à un creux HF côté soleil pendant ~10-60 min ; patienter, se reporter sur les zones côté nuit/grayline, reprendre dès la fin du fadeout.
- **De nuit** : ignorer les flares (pas d'effet) ; seul le Kp compte.

## 7. Prévision spécifique IARU HF 2026 (relevé NOAA 27-day, émis 2026-06-29)

| Date | SFI | A | Kp max | Lecture 40 m |
| --- | --- | --- | --- | --- |
| 2026-07-10 | 140 | 8 | 3 | Légère instabilité, surveiller |
| **2026-07-11 (J1 contest)** | **140** | **5** | **2** | **Calme — conditions idéales, tous caps ouverts** |
| **2026-07-12 (J2 contest)** | **135** | **5** | **2** | **Calme — idéal** |

Prévision favorable : géomagnétisme calme attendu (Kp 2), SFI correct (~135-140). À reconfirmer avec les données live à J-3/J-1, car le 27-day est indicatif et révisé quotidiennement.

## 8. Sources live branchées dans l'app

- NOAA SWPC : Kp 1 min, F10.7 (SFI), éruptions X-ray GOES, prévision 27 jours.
- HamQSL/N0NBH (via Spothole) : SFI, A, K, état des bandes jour/nuit.
- Spothole : spots 40 m réels (clusters + RBN) pour calibrer le modèle.

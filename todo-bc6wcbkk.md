# Session TODO — Intégration Rotor dans DX Hunter

- [x] Analyser l'application Rotor (arcorotctrl) et identifier l'API tRPC
- [x] Analyser l'application DX Hunter et identifier les points d'intégration
- [x] Créer le router backend `server/routers/rotorRelay.ts` (proxy tRPC → API rotor)
- [x] Enregistrer le router `rotor` dans `server/routers.ts`
- [x] Créer le hook `client/src/hooks/useRotor.ts` (polling azimut + goTo + stop)
- [x] Créer le composant `client/src/components/RotorWidget.tsx` (widget barre du haut)
- [x] Ajouter la prop `onRotor` dans `SpotRow.tsx` et le bouton "rot" sur chaque spot
- [x] Intégrer `RotorWidget` dans le header de `Home.tsx`
- [x] Intégrer `onRotor` dans le `SpotRow` de `Home.tsx`
- [x] Sauvegarder le checkpoint et publier
- [x] Corriger bug React #321 — useRotor() mal placé après le return dans Home.tsx
- [x] Remplacer useRotor() dans Home par trpc.rotor.goTo.useMutation() direct (évite double hook)
- [x] Sauvegarder le checkpoint final corrigé

## Amélioration UI — Juillet 2026
- [x] Ajouter le mode Contest (toggle dans les filtres) pour conditionner FAIT/HB
- [x] Refondre capsule QSY+ROT compacte sur chaque spot
- [x] Créer boussole graphique SVG animée dans RotorWidget (barre du haut)
- [x] Sauvegarder le checkpoint final
- [x] Sauvegarder le checkpoint final

## Onglet DXCC dans Multiplicateurs — Juillet 2026
- [x] Créer table dxcc_worked en base (visitorId, dxccCode, band, mode, dxCall, workedAt)
- [x] Créer fichier de données DXCC (shared/dxccEntities.ts — ~340 entités)
- [x] Ajouter procédures tRPC : dxcc.getWorked (filtres bande/mode)
- [x] Créer page DxccTracker (/dxcc) avec grille entités, filtres continent/bande/mode, panneau détail
- [x] Connecter bouton FAIT → logbook → dxcc_worked automatique
- [x] Sauvegarder le checkpoint final DXCC

## Logbook QSO — Juillet 2026
- [x] Créer table qso_log en base (dxCall, freqKhz, band, mode, dxCountry, dxccCode, rstSent, rstRcvd, qsoDateUtc, notes, visitorId)
- [x] Ajouter procédures tRPC : logbook.add, logbook.list, logbook.delete, logbook.exportAdif
- [x] Créer la page Logbook (/logbook) avec tableau des QSO, saisie manuelle, filtres, export ADIF
- [x] Connecter bouton FAIT (mode Contest) → dialog RST → addQso → dxcc_worked automatique
- [x] Mise à jour automatique DXCC depuis le logbook (insert dans dxcc_worked à chaque QSO)
- [x] Sauvegarder le checkpoint final Logbook

## Import ADIF + Stats + Alertes DXCC — Juillet 2026
- [x] Import ADIF : procédure tRPC logbook.importAdif (parsing côté serveur)
- [x] Import ADIF : bouton upload dans la page Logbook
- [x] Statistiques logbook : page /logbook/stats avec graphiques bande/mode/DXCC
- [x] Alertes DXCC nouveau : détection dans useSpots + toast + son depuis Home.tsx

## Déduplication ADIF + Objectif DXCC + Filtre DXCC — Juillet 2026
- [x] Déduplication import ADIF : vérification doublon (indicatif + date + fréquence) avant insertion
- [x] Objectif DXCC : table user_settings (visitorId, dxccGoal), procédure tRPC settings.get/set
- [x] Objectif DXCC : barre de progression dans LogbookStats et DxccTracker
- [x] Filtre DXCC non travaillé : toggle dans FilterPanel + filtrage dans Home.tsx

## Refactoring Layout — Juillet 2026
- [x] Header compact : réduire la hauteur, grouper les icônes, éviter le débordement horizontal
- [x] Tableau spots : colonnes fixes et proportionnées (DX, FREQ, MODE, PAYS, INFO, ACTIONS)
- [x] Alignement vertical des cellules : hauteur uniforme, pas de décalage QSY
- [x] Supprimer le scroll horizontal sur la page principale
- [x] Colonnes propagation/info justifiées et lisibles
- [x] Proxy RSS serveur : DX-World.net + ARNewsline avec cache 30 min
- [x] Page /dxinfo : section expéditions RSS DX-World avec badge DXCC non travaillé
- [x] Page /dxinfo : section calendrier DXNews.com widget embarqué
- [x] Page /dxinfo : section actualités ARNewsline RSS
- [x] Lien icône dans le header vers /dxinfo
- [x] Header mobile : hamburger menu avec Sheet (navigation + outils)
- [x] FilterPanel : Sheet bottom drawer sur mobile
- [x] Tableau spots : layout mobile compact (colonnes réduites)
- [x] Pages secondaires (Logbook, DxInfo, DxccTracker) : headers mobiles

## Logbook v2 — Juillet 2026
- [x] Backend : logbook.list et logbook.count acceptent search, dateFrom, dateTo, sortBy, sortDir
- [x] Logbook.tsx : dates européennes (JJ/MMM/AAAA) avec couleurs par mois
- [x] Logbook.tsx : drapeaux emoji par pays/DXCC
- [x] Logbook.tsx : badges bandes colorés (BAND_COLORS) + badges modes colorés
- [x] Logbook.tsx : colonnes triables (date, indicatif, bande, mode, fréquence) avec icônes de tri
- [x] Logbook.tsx : barre de recherche par indicatif avec debounce 350ms
- [x] Logbook.tsx : filtre période Du/Au avec style amber
- [x] Logbook.tsx : pagination avec boutons première/dernière page
- [x] Logbook.tsx : vue mobile cartes avec mêmes couleurs

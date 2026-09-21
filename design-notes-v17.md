# V17 Design Notes — DXHeat-style Layout

## User References
- DX Summit (dxsummit.fi): Fond clair, tableau propre, barre filtres compacte au-dessus (bouton +Filtres), panneau droit minimal (horloge + recherche)
- DXHeat (dxheat.com/dxc/): Header bleu dégradé, filtres à gauche en colonne (boutons colorés), tableau central (DX de, Fréq, DX, Étiquettes, Commentaires, UTC, Date), panneau droit (horloge UTC géante + recherche + propagation)

## Target Layout (3 colonnes)
1. **Gauche** : Filtres en colonne (boutons colorés type DXHeat : Tous/Aucun, Sources, DXCC, Modes)
2. **Centre** : Tableau spots propre (colonnes alignées, lignes alternées, pas de bruit visuel)
3. **Droite** : Horloge UTC + RunModeLog compact + SelfMonitor + Propagation

## Style
- Switch sombre/clair (ThemeProvider switchable=true, defaultTheme="dark")
- Thème clair : fond blanc, primary bleu oklch(0.55 0.2 250), couleurs vives
- Thème sombre : fond anthracite, primary ambre oklch(0.72 0.17 55)
- Tableau : lignes alternées (.spot-table tbody tr:nth-child(even))
- Typographie : JetBrains Mono (fréquences), Space Grotesk (UI)
- Contraste élevé, taille lisible, pas de polices trop petites

## Key Components to Simplify
- SpotRow.tsx : supprimer badges/icons excessifs, aplatir les actions QSY/rotor
- RunModeLog.tsx : garder compact, masquer les infos QRZ/history jusqu'à saisie d'un call
- FilterPanel.tsx : transformer en colonne gauche avec boutons colorés

## Files Modified
- client/src/index.css : DONE (thème clair + sombre)
- client/src/App.tsx : DONE (switchable theme)
- client/src/pages/Home.tsx : TODO (layout 3 colonnes)
- client/src/components/SpotRow.tsx : TODO (simplifier)

## Theme Toggle
- useTheme() hook available from contexts/ThemeContext.tsx
- toggleTheme() function to switch
- Add Sun/Moon icon button in header

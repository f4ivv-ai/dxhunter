# Notes d'intégration Rotor dans DX Hunter

## API Rotor
- URL: https://arcorotctrl-dkbitpc4.manus.space
- GET état: /api/trpc/rotator.getState?batch=1&input={}
  → {"azimuth": 315, "status": "disconnected", "config": {"host": "<IP-ARCO-masquée>", "port": "<port-masqué>"}}
- POST goTo: /api/trpc/rotator.goTo?batch=1
  Body: {"0":{"json":{"azimuth": 90}}}
  → {"ok": true}
- Autres mutations: rotator.connect, rotator.disconnect, rotator.stop, rotator.rotateCW, rotator.rotateCCW

## QTH utilisateur
- Locator: JN25

## Architecture DX Hunter (fichiers clés)
- /home/ubuntu/dx_hunter/client/src/components/SpotRow.tsx → bouton QSY existant, calcul bearing déjà présent
- /home/ubuntu/dx_hunter/client/src/components/NavBar.tsx → barre du haut, slot "right" disponible
- /home/ubuntu/dx_hunter/client/src/pages/Home.tsx → page principale avec liste des spots

## SpotRow - Props existantes
- spot: {dx_call, dx_country, de_call, freqKhz, mode, band, family, dx_latitude, dx_longitude, isRare, isTarget, time}
- userLat, userLon: coordonnées QTH utilisateur
- onQsy: fonction (freqKhz, mode) → appelée par bouton QSY
- catConnected: booléen → bouton QSY visible seulement si true
- Calcul bearing: Ke(userLat, userLon, dx_latitude, dx_longitude) → {bearing, distance}

## Ce qui est à ajouter
1. Hook useRotor dans client/src/hooks/useRotor.ts
   - Polling getState toutes les 2s
   - Fonction goTo(azimuth)
   - État: {azimuth, status, isConnected}

2. Bouton "rot" dans SpotRow.tsx
   - À côté du bouton QSY
   - Visible si bearing calculé ET onRotor prop fournie
   - Appelle onRotor(bearing)
   - Icône: compass ou antenna

3. RotorWidget dans NavBar.tsx (slot right)
   - Affiche azimut actuel (ex: "315°")
   - 8 boutons rapides: N(0°), NE(45°), E(90°), SE(135°), S(180°), SO(225°), O(270°), NO(315°)
   - Indicateur de connexion (point vert/rouge)

4. Proxy backend dans server/routers.ts
   - rotor.getState → proxy vers API rotor
   - rotor.goTo(azimuth) → proxy vers API rotor
   (pour éviter CORS côté client)

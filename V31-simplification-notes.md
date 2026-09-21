# V31 Simplification Notes

## Routes to REMOVE from App.tsx:
- /logbook → Logbook
- /logbook/stats → LogbookStats
- /dxcc → DxccTracker

## Routes to KEEP:
- / → Landing
- /app → Home (Radar/Cluster)
- /pilot → Pilot
- /forecast → Forecast
- /admin → Admin
- /docs → Docs
- /profile → Profile
- /dxinfo → DxInfo

## Rotor removal:
- Remove RotorWidget from Home.tsx (line 355)
- Remove import useRotor from Home.tsx (line 39)
- Remove onRotor callbacks from SpotRow usage in Home.tsx (line 580)
- Remove RotorWidget import (line 31)
- Keep DxDirections but remove the onRotor prop usage (just show azimut without rotor button)
- Keep useRotor hook file but don't import it in Home.tsx
- Remove RotorWidget.tsx component file

## NavBar:
- Currently shows: Radar, Pilot, Admin (if admin)
- Logbook/DXCC links were already removed from NavBar (not visible in grep)
- Bridge popover: simplify to show only bridge v7 (bridge-relay-v7.mjs)

## Bridge:
- Use bridge-relay-v7.mjs as the single bridge
- Already exists at: /home/ubuntu/dx_hunter/cat-bridge/bridge-relay-v7.mjs
- Upload it and update NavBar download link

## Files to potentially delete:
- client/src/pages/Logbook.tsx
- client/src/pages/LogbookStats.tsx
- client/src/pages/DxccTracker.tsx
- client/src/components/RotorWidget.tsx
- client/src/hooks/useRotor.ts (keep for DxDirections? or remove onRotor from DxDirections)

## Server routers to check:
- Any logbook/dxcc routers can stay (no harm) or be removed

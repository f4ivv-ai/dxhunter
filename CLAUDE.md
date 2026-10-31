# DX Hunter — notes pour Claude

Application de F4IVV : spots DX cluster en temps réel, écoute KiwiSDR/WebSDR, pilotage station (FlexRadio CAT, Antenna Genius, rotor), contest et logbook. Interface et commentaires en français.

## Commandes
- `pnpm install` · `pnpm dev` (Vite + serveur, port 3000) · `pnpm check` · `pnpm test` · `pnpm build` · `pnpm start`
- Base locale : MySQL/MariaDB via `DATABASE_URL` ; les migrations Drizzle (`drizzle/`) s'appliquent au démarrage.
- Nouvelle migration : modifier `drizzle/schema.ts` puis `DATABASE_URL=... pnpm exec drizzle-kit generate`.

## Architecture
- Point d'entrée serveur : `server/_core/index.ts` (Express + tRPC sur `/api/trpc`).
- Connexion : administrateur unique, mot de passe `ADMIN_PASSWORD`, session JWT (`server/_core/oauth.ts`, `sdk.ts`).
- Captures planifiées intégrées : `server/scheduled.ts` (FT8 /15 min, calibration 12:00 UTC).
- Bridges station : `cat-bridge/`, servis par `/downloads/<fichier>` (`server/downloads.ts`).
- Déploiement : Docker Compose (app + MySQL + Caddy HTTPS), voir `DEPLOY.md`.

## Règles
- Aucune dépendance à Manus : ne pas réintroduire OAuth, stockage ou cron de plateforme.
- Commandes radio/antenne/rotor et écritures (logbook, worked, réglages) : `adminProcedure`.
- Ne jamais committer de secret ; jetons bridges ≥ 24 caractères.

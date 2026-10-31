import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduled";
import { ENV } from "./env";
import { runMigrations } from "../migrate";
import { contestQsoHandler } from "../contestEndpoint";
import { initClusterWebSocket } from "../clusterWs";
import { registerImportAdifRoute } from "../importAdifRoute";
import { registerDownloadRoutes } from "../downloads";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (ENV.databaseUrl && process.env.SKIP_MIGRATIONS !== "true") {
    await runMigrations(ENV.databaseUrl);
  }
  if (!ENV.adminPassword) {
    console.warn("[Auth] ADMIN_PASSWORD non défini : connexion administrateur impossible");
  }
  const app = express();
  const server = createServer(app);
  // Derrière le proxy HTTPS (Caddy) : IP client et protocole réels
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // L'import ADIF a sa propre limite (multer, 10 Mo) ; le JSON reste modeste.
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerOAuthRoutes(app);
  registerImportAdifRoute(app);
  registerDownloadRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.post("/api/contest/qso", contestQsoHandler);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // WebSocket DX Cluster feed (Win-Test / DXLog)
  initClusterWebSocket(server);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (ENV.schedulerEnabled && ENV.databaseUrl) startScheduler();
  });
}

startServer().catch(console.error);

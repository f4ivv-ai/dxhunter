/**
 * Téléchargement des bridges station depuis le serveur DX Hunter lui-même
 * (remplace les liens manus-storage).
 *
 * GET /downloads/<fichier> — liste blanche stricte de fichiers de cat-bridge/.
 * L'adresse du serveur par défaut est remplacée à la volée par l'adresse
 * réelle du site : le bridge téléchargé sait où se connecter sans réglage.
 */
import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";

export const DOWNLOADABLE_FILES = new Set([
  "bridge-relay-v7.mjs",
  "bridge-relay-v8.mjs",
  "bridge-simple.mjs",
  "bridge-so2r.mjs",
  "bridge-so2v.mjs",
  "telnet-relay.mjs",
  "start-bridge-v7.sh",
  "start-bridge-v8.sh",
  "start-bridge-simple.sh",
  "start-bridge-so2r.sh",
  "start-bridge-so2v.sh",
]);

const DEFAULT_SERVER_URL = "http://localhost:3000";

export function publicOrigin(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

export function withServerUrl(content: string, origin: string): string {
  return content.split(DEFAULT_SERVER_URL).join(origin);
}

export function registerDownloadRoutes(app: Express, dir = path.resolve(process.cwd(), "cat-bridge")) {
  app.get("/downloads/:file", (req: Request, res: Response) => {
    const file = req.params.file;
    if (!DOWNLOADABLE_FILES.has(file)) {
      res.status(404).send("Fichier inconnu");
      return;
    }
    const full = path.join(dir, file);
    fs.readFile(full, "utf-8", (err, content) => {
      if (err) {
        res.status(404).send("Fichier introuvable");
        return;
      }
      res.setHeader("Content-Type", file.endsWith(".sh") ? "text/x-shellscript" : "text/javascript");
      res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
      res.send(withServerUrl(content, publicOrigin(req)));
    });
  });
}

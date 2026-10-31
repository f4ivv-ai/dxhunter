/**
 * Connexion administrateur locale (remplace l'OAuth Manus).
 *
 * POST /api/auth/login  { password, next? }
 *   - compare le mot de passe à ADMIN_PASSWORD (temps constant)
 *   - crée/actualise le compte administrateur en base (rôle admin, premium)
 *   - dépose le cookie de session
 *
 * Protection anti-force brute : 5 essais par IP et par tranche de 15 minutes.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export const ADMIN_OPEN_ID = "local-admin";
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip: string, now = Date.now()): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string, now = Date.now()) {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/** Comparaison à temps constant via empreinte SHA-256 (longueurs égales). */
export function passwordMatches(provided: string, expected: string): boolean {
  if (!expected || expected.length < MIN_ADMIN_PASSWORD_LENGTH) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** N'accepte qu'un chemin interne ("/app", "/pilot"…), jamais une URL externe. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/app";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/app";
  }
  return next;
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const ip = clientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({ error: "Trop d'essais. Réessayez dans 15 minutes." });
      return;
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!passwordMatches(password, ENV.adminPassword)) {
      recordFailure(ip);
      res.status(401).json({ error: "Mot de passe incorrect" });
      return;
    }
    attempts.delete(ip);

    try {
      await db.upsertUser({
        openId: ADMIN_OPEN_ID,
        name: ENV.adminName,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      });
      await db.ensureAdminPremium(ADMIN_OPEN_ID);

      const token = await sdk.createSessionToken(ADMIN_OPEN_ID, {
        name: ENV.adminName,
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.json({ ok: true, next: safeNextPath(req.body?.next) });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Connexion impossible (base de données ?)" });
    }
  });
}

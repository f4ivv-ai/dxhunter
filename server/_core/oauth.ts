import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { notifyOwner } from "./notification";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a brand new user (first login)
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Initialize trial period for new users
      if (isNewUser) {
        await db.initTrialIfNeeded(userInfo.openId);
      }

      // Notify owner of new registration (non-blocking)
      if (isNewUser) {
        const userName = userInfo.name || "Inconnu";
        const userEmail = userInfo.email || "non renseigné";
        notifyOwner({
          title: `🌟 Nouvelle inscription : ${userName}`,
          content: `Un nouvel utilisateur vient de s'inscrire sur DX Hunter.\n\nNom : ${userName}\nEmail : ${userEmail}\nMéthode : ${userInfo.loginMethod ?? userInfo.platform ?? "OAuth"}\nDate : ${new Date().toISOString()}\n\nRendez-vous sur /admin pour gérer son accès.`,
        }).catch((err) => {
          console.warn("[OAuth] Failed to notify owner of new user:", err);
        });
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Parse returnPath from state if present
      let redirectTo = "/app";
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.returnPath && typeof parsed.returnPath === "string") {
          redirectTo = parsed.returnPath;
        }
      } catch {
        // state is just the redirectUri string, not JSON — use default
      }

      res.redirect(302, redirectTo);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

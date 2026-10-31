/**
 * Sessions DX Hunter — connexion locale, sans service externe.
 *
 * Le serveur signe lui-même un jeton de session (JWT HS256, secret JWT_SECRET)
 * déposé dans un cookie httpOnly. Plus aucun appel à un serveur OAuth tiers.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  name: string;
};

export type AuthenticatedUser = User;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/** Longueur minimale exigée pour JWT_SECRET. */
export const MIN_SESSION_SECRET_LENGTH = 32;

class SessionService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET manquant ou trop court (minimum ${MIN_SESSION_SECRET_LENGTH} caractères)`
      );
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    return new SignJWT({ openId, name: options.name || openId })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(Math.floor((issuedAt + expiresInMs) / 1000))
      .sign(this.getSessionSecret());
  }

  async verifySession(
    token: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, name } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId)) return null;
      return { openId, name: isNonEmptyString(name) ? name : openId };
    } catch {
      return null;
    }
  }

  private readToken(req: Request): string | undefined {
    const header = req.headers.cookie;
    if (header) {
      const cookies = parseCookieHeader(header);
      if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
    }
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice(7);
    }
    return undefined;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const session = await this.verifySession(this.readToken(req));
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    return user;
  }
}

export const sdk = new SessionService();

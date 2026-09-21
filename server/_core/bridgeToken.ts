/**
 * Vérification des jetons partagés (bridge CAT, antenne, concours).
 * Échec fermé si le secret manque, est trop court ou correspond à l'ancien
 * jeton public révoqué.
 */
import { createHash, timingSafeEqual } from "node:crypto";

const REVOKED_TOKEN_SHA256 = new Set([
  "136d974b47337e289a7d5ddd5be312d5479b885242704505b04760a9d6f05e62",
]);
export const MIN_TOKEN_LENGTH = 24;

function isRevokedToken(value: string): boolean {
  const digest = createHash("sha256").update(value).digest("hex");
  return REVOKED_TOKEN_SHA256.has(digest);
}

export function getConfiguredToken(
  envName: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env[envName];
  if (!value || value.length < MIN_TOKEN_LENGTH || isRevokedToken(value)) {
    return null;
  }
  return value;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyToken(
  provided: string | undefined | null,
  envName: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = getConfiguredToken(envName, env);
  if (!expected || !provided) return false;
  return safeEqual(provided, expected);
}

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Page de connexion locale. `returnPath` : page à rouvrir après connexion. */
export const getLoginUrl = (returnPath?: string) => {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/app";
  return `/login?next=${encodeURIComponent(next)}`;
};

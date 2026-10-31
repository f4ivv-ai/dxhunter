export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminName: process.env.ADMIN_NAME || "F4IVV",
  /** URL de l'API tRPC de l'application rotor (vide = rotor désactivé). */
  rotorApiUrl: (process.env.ROTOR_API_URL ?? "").replace(/\/$/, ""),
  /** Active les captures planifiées intégrées (calibration, FT8). */
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
  isProduction: process.env.NODE_ENV === "production",
};

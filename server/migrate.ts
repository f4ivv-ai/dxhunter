/**
 * Applique les migrations Drizzle (dossier drizzle/) au démarrage.
 * Idempotent : seules les migrations manquantes sont exécutées.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await migrate(drizzle(connection), {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
    console.log("[Database] Migrations à jour");
  } finally {
    await connection.end();
  }
}

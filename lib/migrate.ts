import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateBetterSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import path from "path";

/**
 * Run database migrations
 *
 * This script applies all pending migrations from the drizzle/migrations folder
 * to the SQLite database (local or Turso).
 *
 * Environment variables:
 *   TURSO_DATABASE_URL - Turso database URL (optional, uses local SQLite if not set)
 *   TURSO_AUTH_TOKEN - Turso auth token (required if using Turso)
 *
 * Usage:
 *   npm run db:migrate
 *
 * Or in code:
 *   import { runMigrations } from './lib/migrate'
 *   await runMigrations()
 */
export async function runMigrations() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  const migrationsFolder = path.join(process.cwd(), "drizzle/migrations");

  console.log("Running migrations...");

  if (tursoUrl && tursoAuthToken) {
    // Use Turso (LibSQL) for production
    console.log("Using Turso database:", tursoUrl);
    const client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    const db = drizzleLibsql(client);

    try {
      await migrateLibsql(db, { migrationsFolder });
      console.log("✓ Migrations completed successfully on Turso");
    } catch (error) {
      console.error("✗ Migration failed:", error);
      throw error;
    }
  } else {
    // Use local SQLite for development
    console.log("Using local SQLite database");
    const dbPath = path.join(process.cwd(), "database.db");
    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    sqlite.pragma("journal_mode = WAL");

    const db = drizzleBetterSqlite(sqlite);

    try {
      migrateBetterSqlite(db, { migrationsFolder });
      console.log("✓ Migrations completed successfully on local database");
    } catch (error) {
      console.error("✗ Migration failed:", error);
      throw error;
    } finally {
      sqlite.close();
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

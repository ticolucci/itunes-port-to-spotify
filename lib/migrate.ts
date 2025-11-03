import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import path from "path";

/**
 * Run database migrations
 *
 * This script applies all pending migrations from the drizzle/migrations folder
 * to the SQLite database.
 *
 * Usage:
 *   npm run db:migrate
 *
 * Or in code:
 *   import { runMigrations } from './lib/migrate'
 *   await runMigrations()
 */
export function runMigrations() {
  const dbPath = path.join(process.cwd(), "database.db");
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite);

  console.log("Running migrations...");

  try {
    migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle/migrations"),
    });
    console.log("✓ Migrations completed successfully");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    throw error;
  } finally {
    sqlite.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

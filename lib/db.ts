import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";

// Type for our database instance (union of both possible types)
type DbInstance = ReturnType<typeof drizzleBetterSqlite> | ReturnType<typeof drizzleLibsql>;

// Singleton pattern - create only one database connection
let db: DbInstance | null = null;
let sqliteDb: Database.Database | null = null;

export function getDatabase(): DbInstance {
  if (!db) {
    // Check if we're using Turso (production/CI)
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoAuthToken) {
      // Use Turso (LibSQL) for production
      console.log("Connecting to Turso database...");
      const client = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });
      db = drizzleLibsql(client, { schema });
    } else {
      // Use local SQLite for development
      console.log("Connecting to local SQLite database...");
      const dbPath = path.join(process.cwd(), "database.db");
      sqliteDb = new Database(dbPath);

      // Enable WAL mode for better concurrent access and performance
      sqliteDb.pragma("journal_mode = WAL");

      db = drizzleBetterSqlite(sqliteDb, { schema });
    }
  }

  return db;
}

// Helper to close the database connection (mainly for cleanup)
export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  db = null;
}

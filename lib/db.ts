import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import path from "path";
import * as schema from "./schema";

// Type for our database instance
type DbInstance = ReturnType<typeof drizzle>;

// Singleton pattern - create only one database connection
let db: DbInstance | null = null;

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
      db = drizzle(client, { schema });
    } else {
      // Use local SQLite for development via libsql
      console.log("Connecting to local SQLite database...");
      const dbPath = path.join(process.cwd(), "database.db");
      const client = createClient({
        url: `file:${dbPath}`,
      });
      db = drizzle(client, { schema });
    }
  }

  return db;
}

// Helper to close the database connection (mainly for cleanup)
export function closeDatabase(): void {
  db = null;
}

import Database from "better-sqlite3";
import path from "path";

// Singleton pattern - create only one database connection
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // Path to your SQLite database file
    const dbPath = path.join(process.cwd(), "database.db");

    // Create connection with read-write access
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent access and performance
    db.pragma("journal_mode = WAL");
  }

  return db;
}

// Helper to close the database connection (mainly for cleanup)
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

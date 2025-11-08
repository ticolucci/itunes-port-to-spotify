import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    // This is only used for generating migrations locally
    // Migrations are run via lib/migrate.ts which supports both local and Turso
    url: "./database.db",
  },
  verbose: true,
  strict: true,
});

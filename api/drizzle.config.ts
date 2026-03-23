import { defineConfig } from "drizzle-kit";

const databaseUrl =
  typeof Bun !== "undefined"
    ? (Bun.env.DATABASE_URL ?? process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});

import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // Keep everything under a dedicated schema so this app can safely share a
  // Postgres/Neon instance with other projects without name collisions.
  schemaFilter: ["leads"],
} satisfies Config;

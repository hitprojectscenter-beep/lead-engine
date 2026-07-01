import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const hasDb = !!process.env.DATABASE_URL;

// Lazily create a single pooled connection (survives HMR in dev).
declare global {
  // eslint-disable-next-line no-var
  var __leadPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__leadPool) {
    global.__leadPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl: process.env.DATABASE_URL?.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return global.__leadPool;
}

export const db = hasDb ? drizzle(getPool(), { schema }) : null;

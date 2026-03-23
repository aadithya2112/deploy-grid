import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.ts";
import * as schema from "../db/schema.ts";

const client = postgres(env.databaseUrl, {
  max: 1,
  prepare: false,
});

export const db = drizzle(client, { schema });

export { client as sql };

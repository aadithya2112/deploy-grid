import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.ts";
import * as schema from "../db/schema.ts";

function connect() {
  const client = postgres(env.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return { client, db: drizzle(client, { schema }) };
}
const storage = new AsyncLocalStorage<ReturnType<typeof connect>>();
let local: ReturnType<typeof connect> | undefined;
function current() {
  return storage.getStore() ?? (local ??= connect());
}
// Existing repositories retain their interfaces; Workers get a connection per invocation.
export const db = new Proxy({} as ReturnType<typeof connect>["db"], {
  get: (_target, property) => {
    const database = current().db;
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
export const sql = new Proxy(
  (() => {}) as unknown as ReturnType<typeof connect>["client"],
  {
    apply: (_target, _this, args) =>
      Reflect.apply(current().client, current().client, args),
    get: (_target, property) => {
      const client = current().client;
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);
export const client = sql;
export async function withDatabase<T>(run: () => Promise<T>): Promise<T> {
  const connection = connect();
  return storage.run(connection, async () => {
    try {
      return await run();
    } finally {
      await connection.client.end({ timeout: 2 });
    }
  });
}

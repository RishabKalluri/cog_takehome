import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

const g = globalThis as unknown as { __iapDb?: Db };

function open(): Db {
  const file = process.env.DB_PATH ?? path.join(process.cwd(), "data", "platform.db");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  if (file !== ":memory:") sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

/** Single process-wide connection; schema migrations are applied on first use. */
export function getDb(): Db {
  return (g.__iapDb ??= open());
}

export function resetDbForTests() {
  g.__iapDb = undefined;
}
